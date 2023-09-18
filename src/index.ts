import { tileToBBOX, getChildren, bboxToTile, pointToTileFraction, getParent } from '@mapbox/tilebelt'
import sharp from 'sharp'
import fs from 'node:fs/promises'

type Extractor = {  top: number, left: number, width: number, height: number }
type ExtractorWithXYZ = Extractor & { xyz: number[] }

const listExtractor = (width: number, xyz: number[], extractor: Extractor, { tile_size, verbose }: Omit<Required<Options>, 'bbox' | 'padding'>): ExtractorWithXYZ[] => {
  const results: ExtractorWithXYZ[] = []
  if(width <= tile_size) {
    return results
  } else {
    const next_width = Math.floor(width / 2)
    results.push({ xyz, ...extractor })
    const children = getChildren(xyz)
    let index = 0
    const splitter = [[0, 0], [1, 0], [1, 1], [0, 1]] // depends on the order of tilebelt.getChildren
    for (const child_xyz of children) {
      const child_extractor = {
        left: extractor.left + splitter[index][0] * next_width - splitter[index][0],
        top: extractor.top + splitter[index][1] * next_width - splitter[index][1],
        width: next_width,
        height: next_width,
      }
      results.push(...listExtractor(next_width, child_xyz, child_extractor, { tile_size, verbose }))
      index++
    }
    return results
  }
}

type Options = {
  tile_size?: number,
  verbose?: boolean,
  padding?: number,
}

export const defaultOptions: Required<Options> = {
  tile_size: 512,
  verbose: false,
  padding: 0,
}

export const slice = async (input: string, output_dir: string, _options: Options = {}) => {

  const { tile_size, verbose, padding } = { ...defaultOptions, ..._options }

  verbose && console.time('all')

  const image = sharp(input)
  const { width: _width, height: _height } = await image.metadata()
  if(typeof _width !== 'number' || typeof _height !== 'number') {
    throw new Error('Invalid image')
  }

  const initial_bbox = bboxToTile([0,0,0])

  const width = Math.max(_width, _height)
  const canvasBuffer = await image
    .png()
    .resize(width, width, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: padding, bottom: padding, left: padding, right: padding, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()

  await fs.mkdir(output_dir, { recursive: true })

  const total_width = width + padding * 2
  const initial_extractor = { top: 0, left: 0, width: total_width, height: total_width }

  const extractors = listExtractor(
    total_width,
    initial_bbox,
    initial_extractor,
    { tile_size, verbose },
  )
  let count = 0
  const total = extractors.length

  const transparentTiles: { [xyz: string]: true } = {}
  const isAncestorOfOneOfTransparentTiles = (xyz: number[]): boolean => {
    let current_xyz = xyz
    do {
      const [x, y, z] = getParent(current_xyz)
      if(transparentTiles[`${x}/${y}/${z}`]) {
        return true
      } else {
        current_xyz = [x, y, z]
      }
    } while (current_xyz[2] > 0)
    return false
  }

  const isWholeTransparent = async (tile: sharp.Sharp): Promise<boolean> => {
    const data = await tile.clone().raw().toBuffer()
    return data.every((v) => v === 0)
  }

  for (const { xyz: [x, y, z], ...extractor } of extractors) {
    count ++

    if(isAncestorOfOneOfTransparentTiles([z, x, y])) {
      verbose && console.log(`[skipped] ${count}/${total} ${output_dir}/${z}/${x}/${y}.png`)
      continue
    }

    const tile = sharp(canvasBuffer)

    tile
      .extract(extractor)
      .resize(tile_size, tile_size, { fit: 'contain' })

    await fs.mkdir(`${output_dir}/${z}`, { recursive: true })
    await fs.mkdir(`${output_dir}/${z}/${x}`, { recursive: true })

    if(await isWholeTransparent(tile)) {
      transparentTiles[`${x}/${y}/${z}`] = true
      verbose && console.log(`[skipped] ${count}/${total} ${output_dir}/${z}/${x}/${y}.png`)
    } else {
      await tile.toFile(`${output_dir}/${z}/${x}/${y}.png`)
      verbose && console.log(`[generated] ${count}/${total} ${output_dir}/${z}/${x}/${y}.png`)
    }
  }
  verbose && console.timeEnd('all')
}
