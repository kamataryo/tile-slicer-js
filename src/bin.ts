import { program } from 'commander'
import { slice } from './index'

program
  .argument('<input>', 'input file')
  .argument('<output>', 'output directory')
  .option('-s --tile-size <size>', 'tile size', '256')
  .option('-V --verbose')

program.parse()
const [input, output] = program.args
const { verbose, tileSize } = program.opts()
const tile_size = parseInt(tileSize)

slice(input, output, { tile_size, verbose })
