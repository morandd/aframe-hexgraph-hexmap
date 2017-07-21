window.tic = function(){
  return new Date();
};

// Return elapsed milisconds
window.toc = function(ticStart){
  var elapsed = new Date() - ticStart;
  //elapsed = elapsed.getTime();
  return (elapsed/1000).toFixed(2) ;
};


if (AFRAME === undefined) {
	console.error('AFRAME is not loaded')
}

if (d3 === undefined) {
	console.error('d3 is not loaded. It is required by aframe-hexgraph-hexmap');
}

 AFRAME.registerComponent("aframe-hexgraph-hexmap", {

	schema: {
		// Basic data
		src:         	 { type: "asset"},
		width:           { type: "number", default: 1 },
		invertElevation: { type: "boolean", default: false},
		wireframeOnly:   { type: "boolean", default:false},
		wireframeOn:     { type: "boolean", default:false}, // If you set this, maybe you also want to provide a palette consisting of a single color
		wireframeColor:  { type: "color", default:"#888888"},
		NODATA_VALUE:    { type: "number", default:-9999},
		tileScale:       { type: "number", default: 0.7}, // How much of the hex cell to fill with a rendered tiles
		showZerovalCells:{ type: "boolean", default: false}, // Render cells with zero value
		hexDensity:      { type: "number", default:0.3},
		hexDensityMobile:{ type: "number", default:0.1},

		loadingAnimDur:  { type: "number", default: 3500},
		unloadingAnimDur:{ type: "number", default: 500},
		loadingAnimDelay:  { type: "number", default: 0},

		palette:         { type: "string", default: 'redblue'},
		flipPalette:     { type: "boolean", default: false},
		scaleOpacity:    { type: "boolean", default: true},  // Scale the height of each hex tile according to its value?
		scaleHeight:     { type: "boolean", default: true},  // Scale the height of each hex tile according to its value?
		scaleArea:       { type: "boolean", default: true}, // Scale the area of each hex tile according to its value?

		shading: 		 { type:"string", default:"flat"}, // can be "flat" or "smooth"
		opacity:         { type:"number", default: 0.75 },
		emissive: 		 { type: 'color', default: '#000000'},
		emissiveIntensity:{ type:"number", default:0},
		metalness:       { type: "number", default:0.5},
		shininess: 		 { type: 'number', default: 30}, 
		roughness: 		 { type: 'number', default: 0.5},
		blending: 	     { type: 'string', default: 'THREE.NormalBlending'},
		specular:        { type: 'color', default: '#111111'}

	},


	init: function () {
		if (AFRAME.utils.device.isMobile()) this.data.hexDensity = this.data.hexDensityMobile;
		this.rawData=null;
		this.vscale = 1;
		this.geo = null;
		this.material = null;
		this.el.components.scale.desiredY = this.el.components.scale.data.y;
		console.time("aframe-hexgraph-hexmap init and load data");
	},


	remove: function () {
		return;
	},


	customVertexShader: '' +
//		'     attribute float opacity;' + // Vertex opacity
		'     attribute float height01;' + // Desired height of this vertex
		//    '     varying vec4 vColor;' +
		'     varying float vOpacity;' + // passed to the frag shader via the interpolator
		'     varying float vHeight;' + // Passed to the frag shader via the interpolator
		//    '     uniform sampler2D paletteTexture; ' +
		'     uniform float vscale;' + // Scaling uniform used to drive animations
		'     varying vec3 vViewPosition;' +
		'     vec3 positionAdj; ' + 
	' varying vec3 vNormal; varying vec3 vWorldNormal; varying vec3 vPos; varying vec3 vWorldPos;' +
		'     void main() {' +
		'       vHeight = height01 * vscale;' + 
		'       vOpacity = log(height01+1.0)/log(2.0)*vscale ;' + 
		'       positionAdj  = position; positionAdj.y = positionAdj.y * vscale; ' +
	' vNormal= normalize(normalMatrix * normal);  vWorldNormal = normal; ' + 
	' vPos = ( modelViewMatrix * vec4(position, 1.0)).xyz; vWorldPos=positionAdj;' +
	'    vec4 vertPos4 = modelViewMatrix * vec4(positionAdj, 1.0); ' + 
    ' vPos = vec3(vertPos4) / vertPos4.w; '+ 
		'       gl_Position = projectionMatrix * modelViewMatrix * vec4( positionAdj, 1.0 );' +
		'       vViewPosition = gl_Position.xyz;' +
		'     }',

v2: `
varying vec3 vecPos;
varying vec3 vecNormal;
attribute float height01;
uniform float my_opacity;
uniform float my_showZeroVals;
uniform float scaleOpacity;
uniform float vscale;
varying float vOpacity;
varying float vHeight;
vec3 positionAdj;

void main() {
  vHeight = height01 * vscale;

  if (scaleOpacity>0.0) {
  	vOpacity = log(height01+1.0)/log(2.0); 
  	if (my_showZeroVals==0.0) vOpacity = vOpacity * vscale;
  } else {
	vOpacity  = my_opacity * vscale;
	if (my_showZeroVals>0.0) vOpacity = my_opacity;
  }

  // Adjust position based on vscale
  positionAdj  = position; positionAdj.y = positionAdj.y * vscale; 

  // Since the light is in camera coordinates,
  // I'll need the vertex position in camera coords too
  vecPos = (modelViewMatrix * vec4(positionAdj, 1.0)).xyz;

  // That's NOT exacly how you should transform your
  // normals but this will work fine, since my model
  // matrix is pretty basic
  vecNormal = (modelViewMatrix * vec4(normal, 0.0)).xyz;

  gl_Position = projectionMatrix * vec4(vecPos, 1.0);
}
`,
p2:
`

varying vec3 vecPos;
varying vec3 vecNormal;
varying float vOpacity;
varying float vHeight;

uniform float lightIntensity;
uniform sampler2D textureSampler;

struct PointLight {
	vec3 position;
	vec3 color;
	float distance;
	float decay;

	int shadow;
	float shadowBias;
	float shadowRadius;
	vec2 shadowMapSize;
};
#if NUM_POINT_LIGHTS>0
uniform PointLight pointLights[NUM_POINT_LIGHTS];
#endif
uniform sampler2D paletteTexture;
vec4 c;
void main(void) {
	c = texture2D(paletteTexture, vec2(vHeight, 0.0));
	// Pretty basic lambertian lighting...
	vec4 addedLights = vec4(0.0, 0.0, 0.0, 0.0);
#if NUM_POINT_LIGHTS>0
	for(int l = 0; l < NUM_POINT_LIGHTS; l++) {
	  vec3 lightDirection = normalize(vecPos - pointLights[l].position);
	  addedLights.rgb += clamp(dot(-lightDirection, vecNormal), 0.0, 1.0) * pointLights[l].color ;
	}
#else
	// If there are zero point lights, we just create 2 point lights.
	// Without these the hex pillars have no shading so they basically appear as bars, not 3d objects
	addedLights.rgb += clamp(dot(-normalize(vecPos - (viewMatrix * vec4(1.0, 0.5, 0.3, 1.0)).xyz), vecNormal), 0.0, 1.0) * vec3(1.0, 1.0, 1.0);
	addedLights.rgb += clamp(dot(-normalize(vecPos - (viewMatrix * vec4(-1.0, 0.5, 0.0, 1.0)).xyz), vecNormal), 0.0, 1.0) * vec3(1.0, 1.0, 1.0);
#endif

	c = mix(c, addedLights, 0.2);
	c.w = vOpacity ;
	gl_FragColor = c;
}
`,

	customFragShader: '' +
		//'     varying vec4 vColor;' +
		'     varying float vHeight;' +
		'     varying float vOpacity;' +
		'     uniform sampler2D paletteTexture; ' +
		'     vec4 c;' +
		'     void main() {' +
		'       c = texture2D(paletteTexture, vec2(vHeight, 0.0));' +
		'       c.w = vOpacity;' +
		'       gl_FragColor = c;' +
		'     }',

		customFragShaderWithLights: `
/* From: https://stackoverflow.com/questions/37342114/three-js-shadermaterial-lighting-not-working */
			uniform vec3 diffuse;
			varying vec3 vPos; // pixel in camera coordinates
			varying vec3 vWorldPos;
			varying vec3 vViewPosition;
			varying vec3 vNormal;
			varying vec3 vWorldNormal;
			varying float vOpacity;
			varying float vHeight;

			const vec3 fixedLight1 = vec3(1.0, 0.5, 0.0);
			const vec3 ambientColor = vec3(0.3, 0.0, 0.0);
			const vec3 diffuseColor = vec3(0.5, 0.0, 0.0);
			const vec3 specColor = vec3(1.0, 1.0, 1.0);



		struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;

		int shadow;
		float shadowBias;
		float shadowRadius;
		vec2 shadowMapSize;
	};
			uniform PointLight pointLights[ NUM_POINT_LIGHTS ];


			uniform sampler2D paletteTexture;

			vec4 c;

			void main() {
				c = texture2D(paletteTexture, vec2(vHeight, 0.0));
				c.w = vOpacity;

				
				vec4 addedLights = vec4(0.1, 0.1, 0.1, 1.0);
				for(int l = 0; l < NUM_POINT_LIGHTS; l++) {
					vec3 adjustedLight = pointLights[l].position + cameraPosition;
					vec3 lightDirection = normalize(vPos - adjustedLight);
					addedLights.rgb += clamp(dot(-lightDirection, vNormal), 0.0, 1.0) * pointLights[l].color;

					//vec3 dir = normalize(/*vWorldPos.xyz -*/ pointLights[l].position - cameraPosition);
					vec3 dir = normalize(vPos - pointLights[l].position + (viewMatrix * vec4(cameraPosition,1.0)).xyz);
					//dir = normalize(fixedLight1 - vPos);
					//dir = vec3(1.0,0.5,0);
					addedLights.rgb += clamp(dot(-dir, normalize(-vPos)), 0.0, 1.0) * pointLights[l].color;
					//addedLights = vec4(lightDirection,1.0);

				}
				
				//vec3 dir = normalize(fixedLight1 - vPos);
				//addedLights.rgb += clamp(dot(-dir, normalize(-vPos)), 0.0, 1.0) * pointLights[l].color;




				gl_FragColor = addedLights; 
				//mix(vec4(diffuse.x, diffuse.y, diffuse.z, 1.0), addedLights, addedLights);

				addedLights += vec4(.0, .0, .0, 1.);
				//gl_FragColor = c * addedLights * c;

			}`,



	update: function (oldData) {
		var thisComponent = this;
		var elData = this.data;
		var data = this.data;

		var el = this.el;
		var diff = AFRAME.utils.diff(elData, oldData);

		//if (Object.keys(diff).length===0) return;




        this.t_load = window.tic();


		if ("src" in diff || "wdith" in diff ) {

			var isJSON = (typeof elData.src==="string") && (elData.src.length>0) && (elData.src.search(/\.json/i)>0);

			if (isJSON) {
				d3.json(elData.src, function(json) {
					this.rawData = json.data;
					this.NROWS = json.data.length;
					this.NCOLS = json.data[0].length;
					thisComponent.update(elData);  // Force re-update
				}); //end JSON loader
			} else { // Assume it is an Image object or a image name (string)
				var img;
		        if (typeof elData.src === "string") {
		        	img = document.querySelectorAll('[src="' + elData.src + '"]');
			      	if (img.length===0) {
						console.error('Cannot find an HTML <img> element on this page with src='+elData.src );
						return;
			      	}
			      	img=img[0];
			    } else {
				img = elData.src;
				}
  // Now img is an Image object or Element object
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
					thisComponent.rawData = new Uint8Array(img.width * img.height);
					for (var i=0, j=0; j<thisComponent.rawData.length; i+=4, j++) thisComponent.rawData[j] = imgBytes[i];

					thisComponent.NROWS = img.height;
					thisComponent.NCOLS = img.width;
					thisComponent.newData = true;
					thisComponent.update(elData);  // Force re-update
				}// onImageLoaded

			}
		}



		/*
		 * Here we can draw any bits that do not care about the JSON data
		 */

        this.t_load = window.toc(this.t_load);




		var updateGeometry = false;
		var updateMaterial = false;

		if (!this.geo) updateGeometry = true;
		if (!this.material) updateMaterial = true;
		if (this.newData) { updateGeometry = true; thisComponent.newData = false; }

		if ("opacity" in diff) updateMaterial = true;
		if ("palette" in diff) updateMaterial = true;
		if ("flipPalette" in diff) updateMaterial = true;
		if ("palette" in diff) updateMaterial = true;
		if ("palette" in diff) updateMaterial = true;
		if ("scaleOpacity" in diff) updateMaterial = true;
		if ("scaleArea" in diff) updateGeometry = true;
		if ("src" in diff) updateGeometry = true;

		if ("showZerovalCells" in diff) {updateGeometry = true; updateMaterial = true;}
		if ("wireframeOn" in diff) updateMaterial = true;
		if ("scaleArea" in diff) updateGeometry = true;
		if ("scaleArea" in diff) updateGeometry = true;
		if (elData.unloadingAnimCompleted) updateGeometry = true;
		// TODO add all the other attribures that can trigger a material refresh
		

		if (updateGeometry) {

			/*
			 * Here we can do unloading animation (if there is an existing geometry to unload)
			 */
			if (elData.unloadingAnimDur>0 && d3===undefined ) {
				elData.unloadingAnimDur = 0;
				console.log('aframe-hexgraph-hexmap: skiping unloading animation since d3 is not available');
				elData.unloadingAnimCompleted = true;
			}
			elData.unloadingAnimCompleted = elData.unloadingAnimCompleted || false;
			if (elData.unloadingAnimDur===0) elData.unloadingAnimCompleted = true; // If no animation was requested, we're already done :)
			if (!this.el.getObject3D('mesh')) elData.unloadingAnimCompleted = true; // If we have no geometry (first time we get loaded), we're already done
			if (!elData.unloadingAnimCompleted) {
				//Then play the flatten animation
				d3.select(this.el).transition().duration(elData.unloadingAnimDur).tween('vscale',function(){return function(t){
			          this.vscale = t;
			          if (this.material.uniforms) this.material.uniforms.vscale.value = (1-t);
					//this.components.scale.data.y = this.components.scale.desiredY * (1-t);
					//this.components['aframe-hexgraph-hexmap'].material.opacity= this.components['aframe-hexgraph-hexmap'].data.opacity * (1-t);
					//this.components.scale.update();
					return "";
				}.bind(thisComponent)}).on("end", function(a,b,c){

					// Call back to update() after flattening animation has completed
					this.data.unloadingAnimCompleted=true; this.update(elData);
				}.bind(thisComponent));
				return;
			} // Set up loading animation?
		}


		this.t_total = window.tic();
		this.t_geom = "0.0";
		this.t_norm = "0.0";
		this.t_bin = "0.0";

	    /*
	     * Convert palette string into array of colors
	     * We put built-in palettes here too.
	     */
	    if ("palette" in diff  || "flipPalette" in diff || !Array.isArray(this.palette) ) {
	    	data.palette = data.palette.toLowerCase();
	      if ("greypurple" === data.palette) {
	        this.palette=['#f7fcfd','#e0ecf4','#bfd3e6','#9ebcda','#8c96c6','#8c6bb1','#88419d','#6e016b'];
	      } else if ("aquablues" === data.palette) {
	        this.palette = ['#f7fcf0','#e0f3db','#ccebc5','#a8ddb5','#7bccc4','#4eb3d3','#2b8cbe','#08589e'];
	      } else if ("reds" === data.palette) {
	        this.palette = ['#fff7ec','#fee8c8','#fdd49e','#fdbb84','#fc8d59','#ef6548','#d7301f','#990000'];
	      } else if ("redblue" === data.palette) {
	        this.palette = ["#2166ac", "#4393c3", "#92c5de", "#d1e5f0", "#fddbc7", "#f4a582", "#d6604d", "#b2182b"];  
	      } else if ("RdYlBu" === data.palette) {
	        this.palette = ['#a50026','#d73027','#f46d43','#fdae61','#fee090','#ffffbf','#e0f3f8','#abd9e9','#74add1','#4575b4','#313695']
	     } else if ("grass" === data.palette) {
	        this.palette = ['#ffffe5','#f7fcb9','#d9f0a3','#addd8e','#78c679','#41ab5d','#238443','#006837','#004529'];
	      } else if ("greens" === data.palette) {
	        this.palette = ['#78c679','#41ab5d','#238443','#006837','#004529'];
	      } else if ("winter" === data.palette) {
	        this.palette = ['#0000FF','#0004FC','#0008FA','#000CF8','#0010F6','#0014F4','#0018F2','#001CF0','#0020EE','#0024EC','#0028EA','#002CE8','#0030E6','#0034E4','#0038E2','#003CE0','#0040DE','#0044DC','#0048DA','#004CD8','#0050D6','#0055D4','#0059D2','#005DD0','#0061CE','#0065CC','#0069CA','#006DC8','#0071C6','#0075C4','#0079C2','#007DC0','#0081BE','#0085BC','#0089BA','#008DB8','#0091B6','#0095B4','#0099B2','#009DB0','#00A1AE','#00A5AC','#00AAAA','#00AEA7','#00B2A5','#00B6A3','#00BAA1','#00BE9F','#00C29D','#00C69B','#00CA99','#00CE97','#00D295','#00D693','#00DA91','#00DE8F','#00E28D','#00E68B','#00EA89','#00EE87','#00F285','#00F683','#00FA81','#00FF7F'];
	      } else if ("plasma" === data.palette) {
	        this.palette =['#0C0786','#100787','#130689','#15068A','#18068B','#1B068C','#1D068D','#1F058E','#21058F','#230590','#250591','#270592','#290593','#2B0594','#2D0494','#2F0495','#310496','#330497','#340498','#360498','#380499','#3A049A','#3B039A','#3D039B','#3F039C','#40039C','#42039D','#44039E','#45039E','#47029F','#49029F','#4A02A0','#4C02A1','#4E02A1','#4F02A2','#5101A2','#5201A3','#5401A3','#5601A3','#5701A4','#5901A4','#5A00A5','#5C00A5','#5E00A5','#5F00A6','#6100A6','#6200A6','#6400A7','#6500A7','#6700A7','#6800A7','#6A00A7','#6C00A8','#6D00A8','#6F00A8','#7000A8','#7200A8','#7300A8','#7500A8','#7601A8','#7801A8','#7901A8','#7B02A8','#7C02A7','#7E03A7','#7F03A7','#8104A7','#8204A7','#8405A6','#8506A6','#8607A6','#8807A5','#8908A5','#8B09A4','#8C0AA4','#8E0CA4','#8F0DA3','#900EA3','#920FA2','#9310A1','#9511A1','#9612A0','#9713A0','#99149F','#9A159E','#9B179E','#9D189D','#9E199C','#9F1A9B','#A01B9B','#A21C9A','#A31D99','#A41E98','#A51F97','#A72197','#A82296','#A92395','#AA2494','#AC2593','#AD2692','#AE2791','#AF2890','#B02A8F','#B12B8F','#B22C8E','#B42D8D','#B52E8C','#B62F8B','#B7308A','#B83289','#B93388','#BA3487','#BB3586','#BC3685','#BD3784','#BE3883','#BF3982','#C03B81','#C13C80','#C23D80','#C33E7F','#C43F7E','#C5407D','#C6417C','#C7427B','#C8447A','#C94579','#CA4678','#CB4777','#CC4876','#CD4975','#CE4A75','#CF4B74','#D04D73','#D14E72','#D14F71','#D25070','#D3516F','#D4526E','#D5536D','#D6556D','#D7566C','#D7576B','#D8586A','#D95969','#DA5A68','#DB5B67','#DC5D66','#DC5E66','#DD5F65','#DE6064','#DF6163','#DF6262','#E06461','#E16560','#E26660','#E3675F','#E3685E','#E46A5D','#E56B5C','#E56C5B','#E66D5A','#E76E5A','#E87059','#E87158','#E97257','#EA7356','#EA7455','#EB7654','#EC7754','#EC7853','#ED7952','#ED7B51','#EE7C50','#EF7D4F','#EF7E4E','#F0804D','#F0814D','#F1824C','#F2844B','#F2854A','#F38649','#F38748','#F48947','#F48A47','#F58B46','#F58D45','#F68E44','#F68F43','#F69142','#F79241','#F79341','#F89540','#F8963F','#F8983E','#F9993D','#F99A3C','#FA9C3B','#FA9D3A','#FA9F3A','#FAA039','#FBA238','#FBA337','#FBA436','#FCA635','#FCA735','#FCA934','#FCAA33','#FCAC32','#FCAD31','#FDAF31','#FDB030','#FDB22F','#FDB32E','#FDB52D','#FDB62D','#FDB82C','#FDB92B','#FDBB2B','#FDBC2A','#FDBE29','#FDC029','#FDC128','#FDC328','#FDC427','#FDC626','#FCC726','#FCC926','#FCCB25','#FCCC25','#FCCE25','#FBD024','#FBD124','#FBD324','#FAD524','#FAD624','#FAD824','#F9D924','#F9DB24','#F8DD24','#F8DF24','#F7E024','#F7E225','#F6E425','#F6E525','#F5E726','#F5E926','#F4EA26','#F3EC26','#F3EE26','#F2F026','#F2F126','#F1F326','#F0F525','#F0F623','#EFF821'];
	      } else if ("viridis" === data.palette) {
	        this.palette = ['#440154','#440255','#440357','#450558','#45065A','#45085B','#46095C','#460B5E','#460C5F','#460E61','#470F62','#471163','#471265','#471466','#471567','#471669','#47186A','#48196B','#481A6C','#481C6E','#481D6F','#481E70','#482071','#482172','#482273','#482374','#472575','#472676','#472777','#472878','#472A79','#472B7A','#472C7B','#462D7C','#462F7C','#46307D','#46317E','#45327F','#45347F','#453580','#453681','#443781','#443982','#433A83','#433B83','#433C84','#423D84','#423E85','#424085','#414186','#414286','#404387','#404487','#3F4587','#3F4788','#3E4888','#3E4989','#3D4A89','#3D4B89','#3D4C89','#3C4D8A','#3C4E8A','#3B508A','#3B518A','#3A528B','#3A538B','#39548B','#39558B','#38568B','#38578C','#37588C','#37598C','#365A8C','#365B8C','#355C8C','#355D8C','#345E8D','#345F8D','#33608D','#33618D','#32628D','#32638D','#31648D','#31658D','#31668D','#30678D','#30688D','#2F698D','#2F6A8D','#2E6B8E','#2E6C8E','#2E6D8E','#2D6E8E','#2D6F8E','#2C708E','#2C718E','#2C728E','#2B738E','#2B748E','#2A758E','#2A768E','#2A778E','#29788E','#29798E','#287A8E','#287A8E','#287B8E','#277C8E','#277D8E','#277E8E','#267F8E','#26808E','#26818E','#25828E','#25838D','#24848D','#24858D','#24868D','#23878D','#23888D','#23898D','#22898D','#228A8D','#228B8D','#218C8D','#218D8C','#218E8C','#208F8C','#20908C','#20918C','#1F928C','#1F938B','#1F948B','#1F958B','#1F968B','#1E978A','#1E988A','#1E998A','#1E998A','#1E9A89','#1E9B89','#1E9C89','#1E9D88','#1E9E88','#1E9F88','#1EA087','#1FA187','#1FA286','#1FA386','#20A485','#20A585','#21A685','#21A784','#22A784','#23A883','#23A982','#24AA82','#25AB81','#26AC81','#27AD80','#28AE7F','#29AF7F','#2AB07E','#2BB17D','#2CB17D','#2EB27C','#2FB37B','#30B47A','#32B57A','#33B679','#35B778','#36B877','#38B976','#39B976','#3BBA75','#3DBB74','#3EBC73','#40BD72','#42BE71','#44BE70','#45BF6F','#47C06E','#49C16D','#4BC26C','#4DC26B','#4FC369','#51C468','#53C567','#55C666','#57C665','#59C764','#5BC862','#5EC961','#60C960','#62CA5F','#64CB5D','#67CC5C','#69CC5B','#6BCD59','#6DCE58','#70CE56','#72CF55','#74D054','#77D052','#79D151','#7CD24F','#7ED24E','#81D34C','#83D34B','#86D449','#88D547','#8BD546','#8DD644','#90D643','#92D741','#95D73F','#97D83E','#9AD83C','#9DD93A','#9FD938','#A2DA37','#A5DA35','#A7DB33','#AADB32','#ADDC30','#AFDC2E','#B2DD2C','#B5DD2B','#B7DD29','#BADE27','#BDDE26','#BFDF24','#C2DF22','#C5DF21','#C7E01F','#CAE01E','#CDE01D','#CFE11C','#D2E11B','#D4E11A','#D7E219','#DAE218','#DCE218','#DFE318','#E1E318','#E4E318','#E7E419','#E9E419','#ECE41A','#EEE51B','#F1E51C','#F3E51E','#F6E61F','#F8E621','#FAE622','#FDE724'];
	      } else if ("parula" === data.palette) {
	        this.palette = ['#3D26A8','#3F2AB4','#412EBF','#4332CA','#4536D5','#463BDE','#4641E5','#4746EB','#474CF0','#4752F4','#4757F7','#465DFA','#4463FC','#4269FD','#3E6FFE','#3875FE','#327BFC','#2E81F9','#2D86F6','#2C8CF2','#2B91EE','#2796EB','#259BE7','#23A0E4','#1FA4E2','#1CA9DF','#18ADDB','#11B1D6','#07B4D0','#00B7C9','#01BAC3','#0BBCBC','#18BFB5','#23C1AE','#2BC3A7','#31C59F','#37C797','#3EC98D','#4ACB84','#56CC7A','#63CC6F','#71CC63','#80CB58','#8FCA4D','#9DC842','#ABC638','#B8C430','#C5C129','#D1BF27','#DCBC28','#E6BA2D','#EFB935','#F8BA3D','#FDBD3C','#FEC338','#FDC933','#FCCF30','#F9D52D','#F6DC29','#F5E227','#F4E824','#F5EF20','#F7F41B','#F9FA14'];
	      } else if ("hot" === data.palette) {
	        this.palette = ['#0A0000','#150000','#1F0000','#2A0000','#350000','#3F0000','#4A0000','#550000','#5F0000','#6A0000','#740000','#7F0000','#8A0000','#940000','#9F0000','#AA0000','#B40000','#BF0000','#C90000','#D40000','#DF0000','#E90000','#F40000','#FF0000','#FF0A00','#FF1500','#FF1F00','#FF2A00','#FF3500','#FF3F00','#FF4A00','#FF5500','#FF5F00','#FF6A00','#FF7400','#FF7F00','#FF8A00','#FF9400','#FF9F00','#FFAA00','#FFB400','#FFBF00','#FFC900','#FFD400','#FFDF00','#FFE900','#FFF400','#FFFF00','#FFFF0F','#FFFF1F','#FFFF2F','#FFFF3F','#FFFF4F','#FFFF5F','#FFFF6F','#FFFF7F','#FFFF8F','#FFFF9F','#FFFFAF','#FFFFBF','#FFFFCF','#FFFFDF','#FFFFEF','#FFFFFF'];
	      } else if ("cool" === data.palette) {
	        this.palette = ['#00FFFF','#04FAFF','#08F6FF','#0CF2FF','#10EEFF','#14EAFF','#18E6FF','#1CE2FF','#20DEFF','#24DAFF','#28D6FF','#2CD2FF','#30CEFF','#34CAFF','#38C6FF','#3CC2FF','#40BEFF','#44BAFF','#48B6FF','#4CB2FF','#50AEFF','#55AAFF','#59A5FF','#5DA1FF','#619DFF','#6599FF','#6995FF','#6D91FF','#718DFF','#7589FF','#7985FF','#7D81FF','#817DFF','#8579FF','#8975FF','#8D71FF','#916DFF','#9569FF','#9965FF','#9D61FF','#A15DFF','#A559FF','#AA55FF','#AE50FF','#B24CFF','#B648FF','#BA44FF','#BE40FF','#C23CFF','#C638FF','#CA34FF','#CE30FF','#D22CFF','#D628FF','#DA24FF','#DE20FF','#E21CFF','#E618FF','#EA14FF','#EE10FF','#F20CFF','#F608FF','#FA04FF','#FF00FF'];
	      } else if ("autumn" === data.palette) {
	        this.palette = ['#FF0000','#FF0400','#FF0800','#FF0C00','#FF1000','#FF1400','#FF1800','#FF1C00','#FF2000','#FF2400','#FF2800','#FF2C00','#FF3000','#FF3400','#FF3800','#FF3C00','#FF4000','#FF4400','#FF4800','#FF4C00','#FF5000','#FF5500','#FF5900','#FF5D00','#FF6100','#FF6500','#FF6900','#FF6D00','#FF7100','#FF7500','#FF7900','#FF7D00','#FF8100','#FF8500','#FF8900','#FF8D00','#FF9100','#FF9500','#FF9900','#FF9D00','#FFA100','#FFA500','#FFAA00','#FFAE00','#FFB200','#FFB600','#FFBA00','#FFBE00','#FFC200','#FFC600','#FFCA00','#FFCE00','#FFD200','#FFD600','#FFDA00','#FFDE00','#FFE200','#FFE600','#FFEA00','#FFEE00','#FFF200','#FFF600','#FFFA00','#FFFF00'];
	      } else {
	        this.palette  = JSON.parse(data.palette.replace(/'/g ,'"'));
	      }

	      // Create a 1xN texture based on this palette
	      this.paletteTexture = palette2texture(this.palette, elData.flipPalette);

	    }



		/*
		OK now we can proceed to build the graph
		*/
		if (updateGeometry) {
			var NROWS = this.NROWS; // Source image dimensions
			var NCOLS = this.NCOLS;

			elData.height = elData.width / (NROWS/NCOLS);
			var AFRAME_UNITS_PER_HEXCELL = Math.min( elData.width/NCOLS/Math.PI*2, elData.height/NROWS/Math.PI*2); //AFrame units per pixel
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
			G.Zrange = [ul[2], lr[2] /(NCOLS/NROWS) /(NCOLS/NROWS)];
			//G.scaleXWorldIntoData = d3.scaleLinear().domain([G.Xrange[0], G.Xrange[1]]).range([1, NCOLS]);
			//G.scaleZWorldIntoData = d3.scaleLinear().domain([G.Zrange[0], G.Zrange[1]]).range([1, NROWS*(NROWS/NCOLS)]);
			grid.renderOffsetX =0;
			grid.renderOffsetZ =0;

			G.scaleDataRowIntoWorld = d3.scaleLinear()
				.domain([1, NROWS])
				.range(G.Zrange);
			G.Xrange = [G.Xrange[0]*1/(vg.SQRT3), G.Xrange[1]*1/(vg.SQRT3) ];
			G.scaleDataColIntoWorld = d3.scaleLinear().domain([1,NCOLS]).range(G.Xrange);
			G.scaleColor = d3.scaleQuantize().domain([0, 1]).range(this.palette);




			/*
			* Binning: Allocate data values into hex grid cells
			*/
			this.t_bin = window.tic();

			var val,cell;
			var maxBin=0;
			var xoff,yoff,qrs, idx;


			// Create  small pool of randomness to make the binning more visually pleasing. 
			// We use a small pool since lots of Math.random() adds ~0.5 seconds to the binning.
			var randomPool = []; for (var i=0; i<100; i++) randomPool.push(Math.random()*0.001);

			//var maxDataVal = 0; for (var i=0; i<elData.rawData.length; i++) maxDataVal = Math.max(maxDataVal, elData.rawData[i]);
			var rawdataIsVector = isFinite(this.rawData[0]);// slower: elData.rawData instanceof Uint8Array;
			for (var rw=0; rw<NROWS; rw++){
				var tmp_ri = rw*NCOLS;
				for (var cl=0; cl<NCOLS; cl++){
					//val = rawdataIsVector ? elData.rawData[rw*NCOLS + cl] : elData.rawData[rw][cl];
					val = this.rawData[tmp_ri + cl];// : elData.rawData[rw][cl];
					if (elData.invertElevation) val = 255 - val;
					xoff= randomPool[rw*cl % randomPool.length]  ; // A bit of wiggle here helps prevent Moire patterns
					yoff= randomPool[(rw*5)*cl % randomPool.length]  ;
					idx = grid.xyz2idx([G.scaleDataColIntoWorld(cl+1)+xoff, 0, G.scaleDataRowIntoWorld(rw+1)+yoff]);
					//if (idx===null)  continue; // should never happen...
					if (grid.cellValsAsArray[idx]===grid.NODATA) {
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

			//for (var rw=0; rw<grid.cellValsAsArray.length; rw++) maxBin = Math.max(maxBin, grid.cellValsAsArray[rw]);

			this.t_bin = window.toc(this.t_bin);



			/*
			 * Normalize cell values to [0-1] range
			 */
			this.t_norm = window.tic();
			var c;
			for (idx=0; idx<grid.numCells; idx++) {
				if (grid.cellValsAsArray[idx]===grid.NODATA) continue;
				grid.cellValsAsArray[idx] =  grid.cellValsAsArray[idx]/maxBin;

				//if (elData.invertElevation) grid.cellValsAsArray[idx] = 1 - grid.cellValsAsArray[idx];

				grid.cellColorsAsArray[idx] = elData.palette.length==1 ? elData.palette[0] : G.scaleColor(data.flipPalette ? (1-grid.cellValsAsArray[idx]) : grid.cellValsAsArray[idx]);
				grid.cellHeightsAsArray[idx] = grid.cellValsAsArray[idx] || 0;
				grid.cellAreasAsArray[idx] = Math.min(0.5, Math.max(0.3, (Math.log(grid.cellValsAsArray[idx])+1)/Math.log(1.8)));
			}
			this.t_norm = window.toc(this.t_norm);



			/*
			 * Generate THREE.BufferGeometry mesh based on the cell values
			*/
			this.t_geom = window.tic();
			this.geo = grid.generateTilesBufGeom({
				tileScale: elData.tileScale,
				scaleHeight: elData.scaleHeight,
				scaleArea: elData.scaleArea,
				scaleColor:  elData.palette.length>1,
				showZerovalCells:elData.showZerovalCells
			});
			this.t_geom = window.toc(this.t_geom);

		} // update geometry?


		/*
		 * Set up material
		 */

		 if ( updateMaterial || updateGeometry ) {
			
			this.material =new THREE.MeshStandardMaterial({
				color:0xffffff,
				emissive: elData.emissive,
				emissiveIntensity:  elData.emissiveIntensity,
				wireframe: false,
				opacity: elData.opacity,
				shading: elData.shading=="flat" ? THREE.FlatShading : THREE.SmoothShading,
				metalness: elData.metalness,
				roughness: elData.roughness,
				blending: eval(elData.blending),
				transparent: elData.opacity!=1 || (elData.loadingAnimDur>0 || elData.unloadingAnimDur>0),
				vertexColors:THREE.VertexColors
			});
			
			this.paletteTexture.needsUpdate = true;
			this.material = new THREE.ShaderMaterial({
				uniforms: THREE.UniformsUtils.merge([
					THREE.UniformsLib['lights'],
					{
						vscale:         { type: 'f', value: this.vscale },
						my_opacity:     { type: 'f', value: elData.opacity },
						my_showZeroVals:{ type: 'f', value: elData.showZerovalCells?1.0:0.0 },
						scaleOpacity:   { type: 'f', value: elData.scaleOpacity?1.0:0.0 },
						paletteTexture: { type: 't', value: this.paletteTexture },
						diffuse: 		{ type: 'c', value: new THREE.Color(0xffffff) }
					}
				]),
				vertexShader:   this.v2,//this.customVertexShader,
				fragmentShader: this.p2,//this.customFragShaderWithLights,
				depthTest:      true,
				transparent:    true,
				lights:true,
				//shading:        THREE.FlatShading,
				vertexColors:   THREE.VertexColors
				//blending: THREE.MultiplyBlending
			});
			this.material.uniforms.paletteTexture.value.needsUpdate = true;


			var meshVertexColoring = elData.palette.length==1 ?  THREE.NoColors : THREE.VertexColors;
			this.materialWireframe = new THREE.MeshBasicMaterial({color:elData.wireframeColor, opacity:0.5, wireframe:true, vertexColors:meshVertexColoring});

		} // update material? 
		//material = new THREE.MeshNormalMaterial({vertexColors:THREE.VertexColors});


		/*
		 ***** Add the Object3d to the scene *******
		 */
		if (updateGeometry || updateMaterial) {
			if (elData.wireframeOnly) {
				var meshEl = document.createElement('a-entity');
				meshEl.setObject3D("mesh", new THREE.Mesh(this.geo, this.materialWireframe));
				el.appendChild(meshEl);
			} else {

				this.el.setObject3D("mesh", new THREE.Mesh(this.geo, elData.wireframe ? this.materialWireframe : this.material));

				if (elData.wireframeOn) {
					var meshEl = document.createElement('a-entity');
					meshEl.setObject3D("mesh", new THREE.Mesh(this.geo, this.materialWireframe));
					el.appendChild(meshEl);
				}
			}
		}

		this.t_total = window.toc(this.t_total);

		console.log('aframe-hexgraph: Done in ' + this.t_total + 
			's. (Load ' + this.t_load +'s, normalize ' + this.t_norm +', bin ' + this.t_bin + ', geometry '+this.t_geom +')');


		/*
		 * Now that we've built the geometry, we can do the flashy vertical scaling animation
		 */
		 if (updateGeometry) {
			if (elData.loadingAnimDur>0 && !d3 ) {
				elData.loadingAnimDur = 0;
				console.log('aframe-hexgraph-hexmap: skiping loading animation since d3 is not available');
				elData.loadingAnimCompleted = true;
			}
			elData.loadingAnimCompleted = elData.loadingAnimCompleted || false;
			if (elData.loadingAnimDur===0) elData.loadingAnimCompleted = true; // If no animation was requested, we're already done :)
			if (!elData.loadingAnimCompleted) {
				// Set us to zero height
				//this.material.opacity = 0;
				//this.el.components.scale.data.y = 0.01;
				//this.el.components.scale.update();
				//Then play the grow animation

				d3.select(this.el).transition().delay(elData.loadingAnimDelay).duration(elData.loadingAnimDur).tween('vscale',function(){return function(t){
			          this.vscale = t;
			          if (this.material.uniforms) this.material.uniforms.vscale.value = t;
					//this.components.scale.data.y = this.components.scale.desiredY * t;
					//this.components.scale.update();	
					//this.components['aframe-hexgraph-hexmap'].material.opacity= this.components['aframe-hexgraph-hexmap'].data.opacity * t;
					return "";
				}.bind(thisComponent)});
				elData.loadingAnimDelay = 0; // We only apply the delay the first time a loading anim is run.
			} // Set up loading animation?

		} // Only do loading anim if geometry got updated

		//this.el.dispatchEvent(new Event("updated"));
		//this.el.emit("updated", {}, false);
	}, // end update() function

	tic: function (a){
		console.log(a);
	}

});







function palette2texture(palette, flip){

  // Create canvas
  var paletteCanvas = document.createElement('canvas');
  paletteCanvas.id = "paletteCanvas" + Math.random();
  paletteCanvas.width = palette.length; paletteCanvas.height=1;
  var ctx = paletteCanvas.getContext('2d');

  // Set up internal function to convert color strings like '#aabbcc' to [200, 100, 255] RGB tuples
  function hexToRgb(hex) {
      if (hex[0]=="#") hex = hex.slice(1); // Chomp leading #
      var bigint = parseInt(hex, 16);
      var r = (bigint >> 16) & 255;
      var g = (bigint >> 8) & 255;
      var b = bigint & 255;
      return [r,g,b];
  }

  // Create ImageData object and populate its .data array
  var id = ctx.createImageData(paletteCanvas.width,1);
  if (flip) {
	  for (var i=paletteCanvas.width-1, j=0; i>0; i--){
	    var a = hexToRgb(palette[i]);
	    id.data[j++] = a[0]; // r
	    id.data[j++] = a[1]; // g 
	    id.data[j++] = a[2]; // b
	    id.data[j++] = 255; // alpha is always 255 
	  }

  } else {
	  for (var i=0, j=0; i<paletteCanvas.width; i++){
	    var a = hexToRgb(palette[i]);
	    id.data[j++] = a[0]; // r
	    id.data[j++] = a[1]; // g 
	    id.data[j++] = a[2]; // b
	    id.data[j++] = 255; // alpha is always 255 
	  }
  }
  ctx.putImageData( id, 0,0); 
  return new THREE.Texture(paletteCanvas);

}












	

vg.HexGrid.prototype.generateTilesBufGeom  = function(config) {
	config = config || {};
	var tiles = [];
	var settings = {
		tileScale: 0.95,
		cellSize: this.cellSize,
		scaleColor: true, // Optional array of cell colors, to apply colors to all vertices of each grid cell
		scaleHeight: true,
		scaleArea: false,
		scaleAreaField: "area", // Key in grid.cell.userData that contains the area scaling factor. Should be in range [0-1]
		scaleColorField: "color",
		valField: "val", // Key in cell.userData that contains the value used for height scaling

		showZerovalCells: true,
		extrudeSettings: {
			amount: 1,
			bevelEnabled: false,
			bevelSegments: 1,
			steps: 1,
			bevelSize: 0.5,
			bevelThickness: 0.5
		}
	};
	settings = vg.Tools.merge(settings, config);



	// overwrite with any new dimensions
	this.cellSize = settings.cellSize;
	this._cellWidth = this.cellSize * 2;
	this._cellLength = (vg.SQRT3 * 0.5) * this._cellWidth;


	this.autogenerated = true;





	/*
	 * Set up a template Geometry item of an extruded hexagon
	 */
	var templateGeometry;
	if (settings.scaleHeight) {
		templateGeometry = new THREE.ExtrudeGeometry(this.cellShape, settings.extrudeSettings);
		//templateGeometry.computeVertexNormals();
		//__private__reverseFaces(templateGeometry);
		//templateGeometry.computeFaceNormals();
	} else {
		templateGeometry = __private__reverseFaces(this.cellShapeGeo);
	}

	// Apply tileScale (this affects the x and y scale; height (z) is treated separately)
	if (settings.tileScale!=1){
		for (var v=0; v<templateGeometry.vertices.length;v++){
			templateGeometry.vertices[v].x*=settings.tileScale;
			templateGeometry.vertices[v].y*=settings.tileScale;
		}
	}

	/*
	 * If we're doing extruded cylinders, we can drop the faces on the floor as they're not visible. This provides a decent speedup.
	 */
	 
	if (settings.scaleHeight){
		var tmp=[];
		for (f=0; f<templateGeometry.faces.length; f++) {
			if (templateGeometry.vertices[templateGeometry.faces[f].c].z===0 && templateGeometry.vertices[templateGeometry.faces[f].b].z===0 && templateGeometry.vertices[templateGeometry.faces[f].a].z===0){
				// Skip this face 
			} else {
				tmp.push (templateGeometry.faces[f]);
			}
		}
		templateGeometry.faces = tmp;
	}
	templateGeometry.rotateX(-90 * (Math.PI/180));

	//templateGeometry.computeVertexNormals();


	var geo       = new THREE.BufferGeometry();
	var NCELLS    = 0; // Number of cells that we actually have to render is less than this.
	var NODATA_VAL = this.NODATA;

	/*
	 * Prune out empty gridcells
	 */
	this.cellValsAsArray.forEach(function(v,idx) {
		if (v!==NODATA_VAL && (v!==0 || settings.showZerovalCells)) NCELLS++;
	});
	console.assert(NCELLS!==0, ('showZerovalCells was false, but all cells are empty?!'));


	var NVERTS    = NCELLS * templateGeometry.faces.length * 3;
	var vertices  = new Float32Array( NVERTS * 3 );
	var normals   = new Float32Array( NVERTS * 3 );
	var height01  = new Float32Array( NVERTS  );
	var vcolors = null;
	if (settings.scaleColor) { vcolors   = new Float32Array( NVERTS * 3 ); }


	/*
	 * Now we actually manipulate the BufferGeometry: adjust the vertex Z coordinates and vertex colors.
	 */
	var vi=0, vci=0, vhi=0, uvi=0,f, val, vert, pos,clr, sh, sa;
	var vA, vB, vC;
	var cellValIdx=0; // index into 
	var thisHexGrid = this;

	//for (var ci=0; ci<this.cellValsAsArray.length; ci++){
	for (var ci=this.cellValsAsArray.length-1; ci>0; ci--){

		val = this.cellValsAsArray[ci];

		if (val==this.NODATA) continue;
		if (!settings.showZerovalCells && val===0 ) continue;

		if (vcolors) {
			clr = this.cellColorsAsArray[ci];
			clr = (clr instanceof THREE.Color) ? clr : new THREE.Color(clr);
		}
		sa = settings.scaleArea ? (this.cellAreasAsArray[ci] || 0) : 1;
		sh = settings.scaleHeight ? Math.max(0.001, this.cellHeightsAsArray[ci]) : 1;

		pos = this.idx2xyz(ci);
		var hexCellX = pos[0] + this.renderOffsetX || 0; 
		var hexCellY = pos[2] + this.renderOffsetZ || 0;

		var pA = new THREE.Vector3();
		var pB = new THREE.Vector3();
		var pC = new THREE.Vector3();
		var cb = new THREE.Vector3();
		var ab = new THREE.Vector3();

		for (var k=0; k<templateGeometry.faces.length*3; k++) height01[vhi++] = this.cellHeightsAsArray[ci];


		// Foreach face in this 3d hexagon cell:
		for (f=0; f<templateGeometry.faces.length; f++) {

			var faceNormal = templateGeometry.faces[f].normal;

			// Vertices are X,Y,Z sequence, so by putting faces.y into vertex Z we do the rotation so that Z axis faces the sky instead of the camera

			var ax = templateGeometry.vertices[templateGeometry.faces[f].a].x*sa + hexCellX;
			var ay = Math.max(0, templateGeometry.vertices[templateGeometry.faces[f].a].y*sh);
			var az = templateGeometry.vertices[templateGeometry.faces[f].a].z*sa + hexCellY;

			var bx = templateGeometry.vertices[templateGeometry.faces[f].b].x*sa + hexCellX;
			var by = Math.max(0, templateGeometry.vertices[templateGeometry.faces[f].b].y*sh);
			var bz = templateGeometry.vertices[templateGeometry.faces[f].b].z*sa + hexCellY;

			var cx = templateGeometry.vertices[templateGeometry.faces[f].c].x*sa + hexCellX;
			var cy = Math.max(0, templateGeometry.vertices[templateGeometry.faces[f].c].y*sh);
			var cz = templateGeometry.vertices[templateGeometry.faces[f].c].z*sa + hexCellY;

			//for (var k=0; k<9; k++) height01[vi+k] = this.cellHeightsAsArray[ci];
			

			pA.set( ax, ay, az );
			pB.set( bx, by, bz );
			pC.set( cx, cy, cz );

			cb.subVectors( pC, pB );
			ab.subVectors( pA, pB );
			cb.cross( ab );

			cb.normalize();

			var nx = cb.x;
			var ny = cb.y;
			var nz = cb.z;


			/*
			// Smooth shading, as calculated by 		templateGeometry.computeVertexNormals();
			normals[vi+0] = templateGeometry.faces[f].vertexNormals[0].x;
			normals[vi+1] = templateGeometry.faces[f].vertexNormals[0].y;
			normals[vi+2] = templateGeometry.faces[f].vertexNormals[0].x;

			normals[vi+3] = templateGeometry.faces[f].vertexNormals[1].x;
			normals[vi+4] = templateGeometry.faces[f].vertexNormals[1].y;
			normals[vi+5] = templateGeometry.faces[f].vertexNormals[1].x;

			normals[vi+6] = templateGeometry.faces[f].vertexNormals[2].x;
			normals[vi+7] = templateGeometry.faces[f].vertexNormals[2].y;
			normals[vi+8] = templateGeometry.faces[f].vertexNormals[2].x;
			*/
			 
			// FLAT SHADING
			normals[vi+0] = nx;
			normals[vi+1] = ny;
			normals[vi+2] = nz;

			normals[vi+3] = nx;
			normals[vi+4] = ny;
			normals[vi+5] = nz;

			normals[vi+6] = nx;
			normals[vi+7] = ny;
			normals[vi+8] = nz;
			
			vertices[vi++] = ax;
			vertices[vi++] = ay;
			vertices[vi++] = az;

			vertices[vi++] = bx;
			vertices[vi++] = by;
			vertices[vi++] = bz;

			vertices[vi++] = cx;
			vertices[vi++] = cy;
			vertices[vi++] = cz;

			if (vcolors){
				vcolors[vci++] = clr.r;
				vcolors[vci++] = clr.g;
				vcolors[vci++] = clr.b;
				vcolors[vci++] = clr.r;
				vcolors[vci++] = clr.g;
				vcolors[vci++] = clr.b;
				vcolors[vci++] = clr.r;
				vcolors[vci++] = clr.g;
				vcolors[vci++] = clr.b;
			}

		} // foreach face

	}// foreach cell tile


	/*
	 * Update the BufferGeometry 
	 */
	geo.addAttribute( 'normal', new THREE.BufferAttribute( normals, 3 ) );
	geo.addAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
	geo.addAttribute( 'height01', new THREE.BufferAttribute( height01, 1 ) );
	if (vcolors) geo.addAttribute( 'color', new THREE.BufferAttribute( vcolors, 3 ) );



	return geo;

};




Array.prototype.max = function() {
  return Math.max.apply(null, this);
};

Array.prototype.min = function() {
  return Math.min.apply(null, this);
};
Array.prototype.abs = function() {
	return this.map(function(v) {return Math.abs(v);});
};






// create a flat, hexagon-shaped grid
vg.HexGrid.prototype.generateCellsAsArray = function(config) {
	config = config || {};
	this.size = typeof config.size === 'undefined' ? this.size : config.size;
	this.NODATA = -9998; // Empty (sparse'd) entries in cellValsAsArray are marked by this value.
	this.cellValsAsArray = new Float32Array((this.size*2 + 1)*(this.size*2 + 1)).fill(this.NODATA);
	this.cellHeightsAsArray = new Float32Array((this.size*2 + 1)*(this.size*2 + 1));
	this.cellAreasAsArray = new Float32Array((this.size*2 + 1)*(this.size*2 + 1));
	this.cellColorsAsArray = [];
	this.numCells = this.cellValsAsArray.length;
};


// create a flat, hexagon-shaped grid
vg.HexGrid.prototype.generateSquareBoardAsArray = function(config) {
	config = config || {};
	this.size = typeof config.size === 'undefined' ? this.size : config.size;
	this.NONEXISTENT_CELL = -9999; // Empty (sparse'd) entries in cellValsAsArray are marked by this value.
	this.cellValsAsArray = new Float32Array((this.size*2 + 1)*2);
	this.cellHeightsAsArray = new Float32Array((this.size*2 + 1)*2);
	this.cellAreasAsArray = new Float32Array((this.size*2 + 1)*2);
	this.cellColorsAsArray = [];
	this.numCells = this.cellValsAsArray.length;
	//this.isSquareBoard = true;
};


/*
	Cases for testing/validating coordinate transforms:
	var testqr = qrs2qr([3, 0, -3]);
	var testidx = grid.qrs2idx([3,0,-3]);
	var test2 = grid.qr2idx(testqr);
	var testqrs = grid.idx2qrs(testidx);
*/


// grid cell (Hex in cube coordinate space) to position in pixels/world
vg.HexGrid.prototype.__private__cellToPixel  = function(cell) {
	return [cell.q * this._cellWidth * 0.75, 0, -((cell.s - cell.r) * this._cellLength * 0.5)];
};

// grid cell coordinate (in cube coordinate space) to position in pixels/world
vg.HexGrid.prototype.qrs2xyz  = function(qrs) {
	if (qrs===null) return null;
	if (qrs.reduce(function(a, b) {return a + b;}, 0) !== 0) return null;

	return [qrs[0] * this._cellWidth * 0.75, 0, -((qrs[2] - qrs[1]) * this._cellLength * 0.5)];
};
// grid cell coordinates into index into a linear array of all cells in this grid
vg.HexGrid.prototype.qr2idx  = function(qr) {
	if (qr===null) return null;
	if (qr2qrs(qr)===null) return null;
	// Hexagonal board constraint:
	if (Math.abs(qr[0]+qr[1])>this.size) return null;

	var _NCOLS = (this.size*2)+1;
	var N = this.size;
	return ((qr[1]+N) * _NCOLS) +  (qr[0] + N + Math.min(qr[1],0));
};


vg.HexGrid.prototype.qrs2idx  = function(qrs) {

	if (qrs.reduce(function(a, b) {return a + b;}, 0) !== 0) return null;
	if (qrs.abs().max()>this.size)
		return null;

	var qr = [qrs[0], qrs[2]];
	// Hexagonal board constraint:
	if (Math.abs(qr[0]+qr[1])>this.size) return null;
	var _NCOLS = (this.size*2)+1;
	var N = this.size;
	return ((qr[1]+N) * _NCOLS) +  (qr[0] + N + Math.min(qr[1],0));

	/* Long-winded version:
	// Convert from cube coordinates (which amit calls x/y/z but vonGrid calls qrs)
	// to axial coordinates, which amit calls Q/R. Not confusing at all.
	var axq = qrs[0]; // qrs[0] is "x" in Amit's cube coordinates
	var axr = qrs[2]; // qrs[2] is "z" in Amit's cube coordinates.

	var _NROWS = (this.size*2)+1;
	var _row = axr+this.size;
	var _col = axq + this.size + Math.min(0.0, axr);
	return (_row*_NROWS*1.0) + _col;
	*/
};

// grid cell coordinates into index into a linear array of all cells in this grid
vg.HexGrid.prototype.idx2qrs  = function(idx) {

	var _NCOLS = (this.size*2)+1;
	var N = this.size;

	var _row = Math.floor( idx / _NCOLS );
	var _col = (idx % _NCOLS) ;
	var r = _row - N;
	var q = _col - N - Math.min(r,0);
	return qr2qrs([q,r]);

};
vg.HexGrid.prototype.idx2xyz  = function(idx) {
	if (idx===null) return null;
	return this.qrs2xyz(this.idx2qrs(idx));
};

vg.HexGrid.prototype.xyz2qrs  = function(xyz) {
	if (xyz===null) return null;
	// convert a position in world space ("pixels") to cell coordinates
	var q = xyz[0] * (vg.HexGrid.TWO_THIRDS / this.cellSize);
	var r = ((-xyz[0] / 3) + (vg.SQRT3/3) * xyz[2]) / this.cellSize;
	return __private_cubeRoundQRS([q, r, -q-r]);
};
vg.HexGrid.prototype.xyz2idx  = function(xyz) {
	if (xyz===null) return null;
	var q = xyz[0] * (vg.HexGrid.TWO_THIRDS / this.cellSize);
	var r = ((-xyz[0] / 3) + (vg.SQRT3/3) * xyz[2]) / this.cellSize;
	return this.qrs2idx(__private_cubeRoundQRS([q, r, -q-r]));
};

function qrs2qr(qrs){
    return [qrs[0], qrs[2]];
}
function qr2qrs(qr){
	return [qr[0], -qr[0]-qr[1]   ,qr[1]];
}

// Same as cubeRound, but operates on a QRS tuple instead of a cell object
function __private_cubeRoundQRS(qrs){
		if (qrs===null) return null;

		var rx = Math.round(qrs[0]);
		var ry = Math.round(qrs[1]);
		var rz = Math.round(qrs[2]);

		var xDiff = Math.abs(rx - qrs[0]);
		var yDiff = Math.abs(ry - qrs[1]);
		var zDiff = Math.abs(rz - qrs[2]);

		if (xDiff > yDiff && xDiff > zDiff) {
			rx = -ry-rz;
		}
		else if (yDiff > zDiff) {
			ry = -rx-rz;
		}
		else {
			rz = -rx-ry;
		}

		return [rx, ry, rz];
}



// Reverses the order of the A,B,C points on each face so that any normals will point -180 degrees
// Used because the default hex geometry normal faces down, not up along the Y axis. So we have to 
// flip it so that a camera at Y>0 position can see it. Alternatively, one could use a material with 
// side==THREE.SideDouble to render both sides. But this is prolly faster.
function __private__reverseFaces(a){
	for (var f=0; f<a.faces.length; f++) {
		var vA = a.faces[f].c;
		var vB = a.faces[f].b;
		var vC = a.faces[f].a;
		a.faces[f].a =vA;
		a.faces[f].b =vB;
		a.faces[f].c =vC;
		a.faces[0].normal.multiplyScalar(-1);
	}
	return a;
}
