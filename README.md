# aframe-hexgraph-hexmap
This data visualization component is inspired directly by the hexmap layer of (http://deck.gl). 

![alt text](https://raw.githubusercontent.com/morandd/aframe-hexgraph-hexmap/master/img/example.png "Example")

[Demo](https://morandd.github.io/aframe-hexgraph-hexmap/example/)

[GitHub](https://morandd.github.io/aframe-hexgraph-hexmap/)

Given X/Y input data in a JSON or image file, it bins the data into a hexagonal grid and renders it
as a BufferGeometry. Tiles can be scaled by height, area and/or color.

This component uses a BufferGeometry under the hood. This is good for performance, but it is hard to update individual cells (to do this you must manipulate individual verticies). So it is intended to create a fixed mesh, not really meant for games.

It is based on the [von-grid](https://github.com/vonWolfehaus/von-grid/) hex map library and
totally indebted to [Amit's](http://www.redblobgames.com/grids/hexagons/) expanation about hex grids.



# API #

| Attribute | Description | Default |
| ---  | --- | --- |
| src | Image or JSON file containing input data |  |
| scaleArea | Scale tile sizes proportional to value? | false |
| scaleHeight | Scale tile height proportional to their value? | true |
| scaleOpacity | Scale tile opacity proportional to their value? | true |
| invertElevation | Normally we treat white=ground and black=peaks. Set this to True to flip that | false |
| palette | A predefined palette or palette as JSON string | redblue |
| flipPalette | Reverse the palette directions? | false |
| width | Width of map, in AFRAME units. | 1 |
| wireframeOn | Display wireframe overlay? | false |
| wireframeColor | Color of wireframe | #fff |
| wireframeOnly | Display only wireframe?   | false |
| NODATA_VALUE | Cells with this value will not be rendered | -999 |
| tileScale | How much of each hex grid should be occupied by the rendered tile? | 0.7 |
| showZerovalCells | Render cells with value=0? | false |
| hexDensity | Density of hex grid relative to input data.  Using higher values, up to 1, will create more hexagons. | 0.3 |
| hexDensityMobile | On mobile devices this value will be used instead of hexDensity | 0.1 |
| shading | Material shading model: "flat" or "smooth" | flat |
| emissive | Emissive color. Used for material | #000000
| emissiveIntensity | Control brightness of the material | 0.2 |
| metalness | Control material appearance. | 0.2 |
| rougness | Control material rougness | 0.5 |
| shininess | Control material shininess | 30 |
| specular | Control material specular color | #111111
| blending | THREE.js blending mode, as string | THREE.NormalBlending |
| opacity | Opacity of the object (only takes effect if scaleOpacity is false, or using a custom material) | 0.75 |
| loadingAnimDur | Loading animation duration (0 to disable) | 3500
| loadingAnimDelay | Delay before playing first loading animation. Subsequent loading anims have 0 delay. | 0
| unloadingAnimDur | Unloading animation duration (0 to disable) | 500



### Color Palettes ###
There are a few built-in palettes:
  `greypurple`, `aquablues`, `reds`, `redblue`, `RdYlBu`, `grass`, `winter`, `greens`,  `autumn`, `hot`, `viridis`, `plasma`, `parula`, and `cool`.
These are taken from [ColorBrewer](http://colorbrewer2.org). See `MATLAB_PALETTE.md` for example of converting MATLAB colormaps to JSON. You can also specify a palette as a JSON array, as shown in the example.

See [aframe-hexgraph-hexmap example]((https://morandd.github.io/aframe-hexgraph-hexmap/example/) to see the palette options in action.


### Animating ###
To animate the height you can simply adjust the Y value of the entity's scale, like this:
`document.querySelector('[aframe-hexgraph-hexmap]').setAttribute('scale', [1, newHeight, 1].join(" "))`. 
You can also adjust the opacity of the geometry similarly: `document.querySelector('[aframe-hexgraph-hexmap]').setAttribute('aframe-hexgraph-hexmap', {opacity: newValue})`



# Input data #
As an image: provide an image URL or aframe asset tag (like "#myImg") as the src. The value will be read from the Red pixel, but greyscale images work fine too (and compress better).

As JSON: provide a URL or aframe asset tag pointing to a .json file. The file should contain only a two-dimensional numeric array as shown in the example .json file. For example the matrix:
```
1 2 3 
4 5 6
7 8 9
```
becomes in JSON:
```
[[1,2,3], [4,5,6], [7,8,9]]
```

Image files have the advantage of offering great built-in compression. Try providing your data as a lower-quaity JPEG and compare the file size against the corresponding JSON file.

Adjust the hexDensity as needed to make it look nice.


# Using #

This component requires D3 and the von-grid hex grid library. 

```
	<script src="//d3js.org/d3.v4.min.js"></script>
	<script src="https://cdn.rawgit.com/morandd/aframe-hexgraph-hexmap/master/hex-grid.min.js"></script>
	<script src="https://cdn.rawgit.com/morandd/aframe-hexgraph-hexmap/v0.0.6/aframe-hexgraph-hexmap.js"></script>

```



## TODO ##
- Eliminate dependency on von-grid. At this point so much of the hex logic has been rewritten we do not use much from that library any more.
- If AFrame adds support for vertexColors=THREE.VertexColoring to the material component, change to read material options from a `material` component
- Support JSON files that contain X/Y/Value tuples, ie scattered instead of continuous data




