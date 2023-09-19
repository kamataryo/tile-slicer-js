import { program } from 'commander'
import { slice, defaultOptions } from './index'

const {
  z: defaultTileZ,
  x: defaultTileX,
  y: defaultTileY,
} = defaultOptions.baseTileIndexes
const defaultZxy = `${defaultTileZ}/${defaultTileX}/${defaultTileY}`

program
  .argument('<input>', 'input file')
  .argument('<output>', 'output directory')
  .option('-s --tile-size <size>', 'tile size', defaultOptions.tile_size.toString())
  .option('-p --padding <padding>', 'padding', defaultOptions.padding.toString())
  .option('-t --base-tile-indexes <z/x/y>', 'base tile indexes', defaultZxy)
  .option('-V --verbose')

program.parse()
const [input, output] = program.args
const { verbose,
  tileSize: _tile_size,
  bbox: _bbox,
  padding: _padding,
  baseTileIndexes: _baseTileIndexes,
} = program.opts()
const tile_size = parseInt(_tile_size)
const padding  = parseInt(_padding)
const [z, x, y]: number[] = _baseTileIndexes
  .split('/')
  .map((val: string) => {
    let num = parseInt(val)
    if(isNaN(num)) {
      num = 0
    }
    return num
  })
  const baseTileIndexes = { z, x, y }

if(isNaN(tile_size)) {
  console.error(`Invalid tile size: ${_tile_size}`)
  process.exit(1)
}

if(isNaN(padding)) {
  console.error(`Invalid padding: ${_padding}`)
  process.exit(2)
}

slice(input, output, { tile_size, verbose, padding, baseTileIndexes })
