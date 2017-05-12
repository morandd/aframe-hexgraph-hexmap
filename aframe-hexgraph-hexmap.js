

Array.prototype.max = function() {
  return Math.max.apply(null, this);
};

Array.prototype.min = function() {
  return Math.min.apply(null, this);
};
Array.prototype.abs = function() {
	return this.map(function(v) {return Math.abs(v);});
};
Array.prototype.rangeDistance = function() {
	console.assert(this.length==2,'Can only handle two-element arrays');
	return Math.abs(this[1]-this[0]);
};



 AFRAME.registerComponent("aframe-hexgraph-hexmap", {

	schema: {
		// Basic data
		src:         	 { type: "asset"},
		width:           { type: "number", default: 1 },
		wireframeOnly:   { type: "boolean", default:false},
		wireframeOn:     { type: "boolean", default:false}, // If you set this, maybe you also want to provide a palette consisting of a single color
		wireframeColor:  { type: "color", default:"#fff"},
		NODATA_VALUE:    { type: "number", default:-9999},
		tileScale:       { type: "number", default: 0.7}, // How much of the hex cell to fill with a rendered tiles
		showZerovalCells:{ type: "boolean", default: true}, // Render cells with zero value
		metalness:       { type: "number", default:0.2},
		hexDensity:      { type: "number", default:0.3},
		hexDensityMobile:{ type: "number", default:0.1},

		palette:          { type: "string", default: '["#2166ac", "#4393c3", "#92c5de", "#d1e5f0", "#fddbc7", "#f4a582", "#d6604d", "#b2182b"]'}, // Taken from Color Brewer. Must be a valid JSON string (readable by JSON.parse())
		scaleHeight:      { type: "boolean", default: true},  // Scale the height of each hex tile according to its value?
		scaleArea:        { type: "boolean", default: true}, // Scale the area of each hex tile according to its value?

		shading: 		  {type:"string", default:"flat"}, // can be "flat" or "smooth"
		emissiveIntensity:{type:"number", default:0.2},
		opacity:          { type:"number", default: 0.75 }
	},


	init: function () {
		if (AFRAME.utils.device.isMobile()) this.data.hexDensity = this.data.hexDensityMobile;
		this.rawData=null;
		console.time("aframe-hexgraph-hexmap init and load data");
	},


	remove: function () {
		return;
	},

	update: function (oldData) {
		var thisComponent = this;
		var elData = this.data;

		var el = this.el;
		var diff = AFRAME.utils.diff(elData, oldData);


		/*
		 * In case just opacity is being animated:
		 */
		if ("opacity" in diff) {
			if (this.el.getObject3D("mesh")) {
				this.el.getObject3D("mesh").material.opacity = this.data.opacity;
				if (Object.keys(diff).length==1) return;
			}
		}



		if ("src" in diff || "wdith" in diff ) {

			if (elData.src.search(/\.png/i)>0) {
				var img = document.querySelectorAll('[src="' + elData.src + '"]');
				img=img[0];
				if (img.complete) onImageLoaded(); else img.addEventListener("load",onImageLoaded);
				return;
				function onImageLoaded(){
					var canvas = document.createElement('canvas');
					canvas.setAttribute("width", img.width);
					canvas.setAttribute("height", img.height);
					canvas.style.display="none";
					document.body.appendChild(canvas);
					var context = canvas.getContext('2d');
					context.drawImage(img, 0, 0);

					var imgBytes = context.getImageData(0, 0,img.width, img.height).data;
					elData.rawData = new Uint8Array(img.width * img.height);
					for (var i=0, j=0; j<elData.rawData.length; i+=4, j++) elData.rawData[j] = imgBytes[i];

					elData.NROWS = img.height;
					elData.NCOLS = img.width;
					thisComponent.update(elData);  // Force re-update
				}// onImageLoaded

			} else {
				d3.json(elData.src, function(json) {
					elData.rawData = json.data;
					elData.NROWS = json.data.length;
					elData.NCOLS = json.data[0].length;
					thisComponent.update(elData);  // Force re-update
				}); //end JSON loader

			}
		}



		/*
		 * Here we can draw any bits that do not care about the JSON data
		 */

		console.timeEnd("aframe-hexgraph-hexmap init and load data");


		// We bail out of the update() function here if we haven"t loaded the JSON data yet
		if (!elData.rawData) { 
			// console.log("Should be retreiving json now");
			return;
		}


	    /*
	     * Convert palette string into array of colors
	     * We put built-in palettes here too.
	     */
	    if (!Array.isArray(data.palette)) {
	      if ("greypurple" === data.palette) {
	        elData.palette=['#f7fcfd','#e0ecf4','#bfd3e6','#9ebcda','#8c96c6','#8c6bb1','#88419d','#6e016b'];
	      } else if ("aquablues" === data.palette) {
	        elData.palette = ['#f7fcf0','#e0f3db','#ccebc5','#a8ddb5','#7bccc4','#4eb3d3','#2b8cbe','#08589e'];
	      } else if ("reds" === data.palette) {
	        elData.palette = ['#fff7ec','#fee8c8','#fdd49e','#fdbb84','#fc8d59','#ef6548','#d7301f','#990000'];
	      } else if ("redblue" === data.palette) {
	        elData.palette = ["#2166ac", "#4393c3", "#92c5de", "#d1e5f0", "#fddbc7", "#f4a582", "#d6604d", "#b2182b"];  
	      } else if ("grass" === data.palette) {
	        elData.palette = ['#ffffe5','#f7fcb9','#d9f0a3','#addd8e','#78c679','#41ab5d','#238443','#006837','#004529'];
	      } else if ("greens" === data.palette) {
	        elData.palette = ['#78c679','#41ab5d','#238443','#006837','#004529'];
	      } else if ("autumn" === data.palette) {
	        elData.palette = ['#ffffe5','#fff7bc','#fee391','#fec44f','#fe9929','#ec7014','#cc4c02','#993404','#662506'];
	      } else {
	        elData.palette  = JSON.parse(data.palette.replace(/'/g ,'"'));
	      }
	    }



		/*
		OK now we can proceed to build the graph
		*/

		var NROWS = elData.NROWS;
		var NCOLS = elData.NCOLS;
		var AFRAME_UNITS_PER_HEXCELL = Math.max( elData.width/NCOLS/Math.PI*2, elData.width/NROWS/Math.PI*2); //AFrame units per pixel
		AFRAME_UNITS_PER_HEXCELL = AFRAME_UNITS_PER_HEXCELL/elData.hexDensity;
		console.assert(elData.hexDensity<=1,'hexDensity cannot be >1');




		/*
		 * Build the base hex grid: Genereate a grid with just slightly fewer cells than our data
		 */
		var grid = new vg.HexGrid({
			cellSize: AFRAME_UNITS_PER_HEXCELL, // size of individual cells
			extrudeSettings: {bevelEnabled:false}
		});
		grid.generateCellsAsArray({
			size: Math.ceil(Math.max(NROWS,NCOLS)*elData.hexDensity) // Edge size is (size+1), since size is radius+1 center cell
		});



		/*
		 * Set ups scaling helpers so we can project our data image/matrix into the hexagon-shaped board grid. 
		 */
		var G = {};
		var ul = grid.qrs2xyz([-grid.size, 0, grid.size ]);
		var lr = grid.qrs2xyz([grid.size, 0, -grid.size]);
		G.Xrange = [ul[0], lr[0]];
		G.Zrange = [ul[2], lr[2]];
		G.scaleXWorldIntoData = d3.scaleLinear().domain([G.Xrange[0], G.Xrange[1]]).range([1, NCOLS]);
		G.scaleZWorldIntoData = d3.scaleLinear().domain([G.Zrange[0], G.Zrange[1]]).range([1, NROWS]);
		grid.renderOffsetX =0;
		grid.renderOffsetZ =0;

		G.scaleDataRowIntoWorld = d3.scaleLinear()
			.domain([1, NROWS])
			.range(G.Zrange);
		G.Xrange = [G.Xrange[0]*1/(vg.SQRT3), G.Xrange[1]*1/(vg.SQRT3) ];
		G.scaleDataColIntoWorld = d3.scaleLinear().domain([1,NCOLS]).range(G.Xrange);
		G.scaleColor = d3.scaleQuantize().domain([0, 1]).range(elData.palette);




		/*
		* Binning: Allocate data values into hex grid cells
		*/
		var val,cell;
		var maxBin=0;
		var xoff,yoff,qrs, idx;

		console.time("aframe-hexgraph-hexmap: binning data");

		for (var rw=0; rw<NROWS; rw++){
			for (var cl=0; cl<NCOLS; cl++){
				val = elData.rawData instanceof Uint8Array ? elData.rawData[rw*NCOLS + cl] : elData.rawData[rw][cl];
				xoff=Math.random() * 0.001; // A bit of wiggle here helps prevent Moire patterns
				yoff = Math.random() * 0.001;
				idx = grid.xyz2idx([G.scaleDataColIntoWorld(cl+1)+xoff, 0, G.scaleDataRowIntoWorld(rw+1)+yoff]);
				if (idx===null) continue;
				if (grid.cellValsAsArray[idx]==grid.NODATA) {
					grid.cellValsAsArray[idx] = val;
					grid.cellHeightsAsArray[idx] = val;
					grid.cellAreasAsArray[idx] = val;
				} else {
					grid.cellValsAsArray[idx] += val;
					grid.cellHeightsAsArray[idx] += val;
					grid.cellAreasAsArray[idx] += val;
				}
				maxBin = Math.max(maxBin, grid.cellValsAsArray[idx]);
			} //foreach data column
		} // foreach data row

		console.timeEnd("aframe-hexgraph-hexmap: binning data");



		/*
		 * Normalize cell values to [0-1] range
		 */
		console.time("aframe-hexgraph-hexmap: normalizing cells");
		var c;
		for (idx=0; idx<grid.numCells; idx++) {
			if (grid.cellValsAsArray[idx]===grid.NODATA) continue;
			grid.cellValsAsArray[idx] =  grid.cellValsAsArray[idx]/maxBin;
			grid.cellColorsAsArray[idx] = elData.palette.length==1 ? elData.palette[0] : G.scaleColor(grid.cellValsAsArray[idx]);
			grid.cellHeightsAsArray[idx] = grid.cellValsAsArray[idx] || 0;
			grid.cellAreasAsArray[idx] = Math.min(0.5, Math.max(0.3, (Math.log(grid.cellValsAsArray[idx])+1)/Math.log(1.8)));
		}
		console.timeEnd("aframe-hexgraph-hexmap: normalizing cells");



		/*
		 * Generate THREE.BufferGeometry mesh based on the cell values
		*/
		var geo = grid.generateTilesBufGeom({
			tileScale: elData.tileScale,
			scaleHeight: elData.scaleHeight,
			scaleArea: elData.scaleArea,
			scaleColor:  elData.palette.length>1,
			showZerovalCells:elData.showZerovalCells
		});




		/*
		 * Set up material
		 */
		var material;
		var meshBaseColor = elData.palette.length==1 ? new THREE.Color(elData.palette[0]) : 0xffffff;
		var meshVertexColoring = elData.palette.length==1 ?  THREE.NoColors : THREE.VertexColors;

		material =new THREE.MeshLambertMaterial({color:0xffffff, emissive: 0xffffff, emissiveIntensity: 0.1, wireframe: false, vertexColors:THREE.VertexColors  });
		material =new THREE.MeshPhongMaterial({color:0xffffff, emissive: 0xffffff, emissiveIntensity: 0.1,shininess: 30,  wireframe: false, vertexColors:THREE.VertexColors  });
		material =new THREE.MeshStandardMaterial({color:0xffffff, emissive: 0xffffff, emissiveIntensity: 0.1, metalness:0, roughness:0, wireframe: false, vertexColors:THREE.VertexColors  });
		material =new THREE.MeshStandardMaterial({color:0xffffff, emissive: 0xffffff, emissiveIntensity: 0.1, transparent:true, opacity:elData.opacity, metalness:0, roughness:0, wireframe: false, vertexColors:THREE.VertexColors  });

		material =new THREE.MeshStandardMaterial({
			color:0xffffff,
			//emissive: 0xffffff,
			emissiveIntensity:  elData.emissiveIntensity,
			wireframe: false,
			opacity: elData.opacity,
			shading: elData.shading=="flat" ? THREE.FlatShading : THREE.SmoothShading,
			metalness: elData.metalness,
			transparent: elData.opacity!=1,
			vertexColors:THREE.VertexColors
		});


		var materialWireframe = new THREE.MeshBasicMaterial({color:elData.wireframeColor, wireframe:true, vertexColors:meshVertexColoring});




		/*
		 ***** Add the Object3d to the scene *******
		 */
		if (elData.wireframeOnly) {
			var meshEl = document.createElement('a-entity');
			meshEl.setObject3D("mesh", new THREE.Mesh(geo, materialWireframe));
			el.appendChild(meshEl);
		} else {

			this.el.setObject3D("mesh", new THREE.Mesh(geo, elData.wireframe ? materialWireframe : material));

			if (elData.wireframeOn) {
				var meshEl = document.createElement('a-entity');
				meshEl.setObject3D("mesh", new THREE.Mesh(geo, materialWireframe));
				el.appendChild(meshEl);
			}
		}



	}, // end update() function


});







	/*
	Alternative materials. Not used since they look a bit strange
	*
	var materialn = new THREE.MeshLambertMaterial( {
		color: 0xffffff,
		shading: elData.shading=="flat" ? THREE.FlatShading : THREE.SmoothShading,
		vertexColors: THREE.VertexColors,
		transparent: elData.opacity!=1,
		opacity:elData.opacity
	});
	// Looks cartoon-ey
	var materialNo = new THREE.MeshPhongMaterial( {
		color: 0xffffff,
		shading: elData.shading=="flat" ? THREE.FlatShading : THREE.SmoothShading,
		vertexColors: THREE.VertexColors,
		shininess:30,
		specular: 0xffffff,
		transparent: elData.opacity!=1,
		opacity:elData.opacity
	});
	*/