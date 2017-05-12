# aframe-hexgraph-hexmap
This data visualization component is inspired directly by the hexmap layer of (deck.gl). 

!(https://raw.githubusercontent.com/morandd/aframe-hexgraph-hexmap/master/img/example.png)

Given X/Y input data in a JSON or image file, it bins the data into a hexagonal grid and renders it
as a BufferGeometry. Tiles can be scaled by height, area and/or color.

It is based on the [von-grid](https://github.com/vonWolfehaus/von-grid/) hex map library and
totally indebted to [Amit's](http://www.redblobgames.com/grids/hexagons/) expanation about hex grids.



## API

| Attribute | Description | Default |
| ---  | --- | --- |
| src | Image or JSON file containing input data |  |
| scaleArea | Scale tile sizes proportional to value? | false |
| scaleHeight | Scale tile height proportional to their value? | true |
| palette | A predefined palette or palette as JSON string | redblue |
| width | Width of map, in AFRAME units. | 1 |
| wireframeOn | Display wireframe overlay? | false |
| wireframeColor | Color of wireframe | #fff |
| wireframeOnly | Display only wireframe?   | false |
| NODATA_VALUE | Cells with this value will not be rendered | -999 |
| tileScale | How much of each hex grid should be occupied by the rendered tile? | 0.7 |
| showZerovalCells | Render cells with value=0? | true |
| metalness | Control material appearance. | 0.2 |
| hexDensity | Density of hex grid relative to input data.  Using higher values, up to 1, will create more hexagons. | 0.3 |
| hexDensityMobile | On mobile devices this value will be used instead of hexDensity | 0.1 |
| shading | Material shading model: "flat" or "smooth" | flat |
| emissiveIntensity | Control brightness of the material | 0.2 |
| opacity | Opacity of the object. | 0.75 |

### Color Palettes ###
There are a few built-in palettes: *greypurple*, *aquablues*, *reds*, *redblue*, *grass*, *greens*, and *autumn*. These are taken from
(http://colorbrewer2.org). You can also specify a palette as a JSON array, as seen in the example.



## Input data ##



## Using ##

This component requires D3 and (for now) the von-grid hex grid library. 

```
	<script src="//d3js.org/d3.v4.min.js"></script>
	<script src="hex-grid.min.js"></script>
	<script src="aframe-hexgraph-hexmap.js"></script>
	<script src="HexGridBufGeom.js"></script>

```



## TODO ##
- Eliminate dependency on von-grid. At this point so much of the hex logic has been rewritten we do not use much from that library any more.
- Combine the two .js's into one file

