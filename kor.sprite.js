/*
kor.sprite.js
version 1.0


A sprite library useful in javascript games.


Software License Agreement (BSD License)

Copyright (c) 2009-2011, Roman Komary
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this 
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice, this
  list of conditions and the following disclaimer in the documentation and/or
  other materials provided with the distribution.

* Neither the name Roman Komary nor the names of its contributors may be
  used to endorse or promote products derived from this software without
  specific prior written permission from Roman Komary.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/*
Dependencies:

kor.media.js
kor.calc.js
*/

var kor;
if (!kor) kor = {};



/*
==========================================

	sprite

	base sprite interface (common for both, kor.sprite as well as kor.sprite_one_of_many):

	.get_pos()
	.set_pos( x, y, s )				everything from s on is optional
	.is_visible()
	.show( bShow )
	.count()						how many images this sprite contains
	.collision_radius
	.spritekind						sprite kind. notice, a value of -1 indicates like none or unknown.
	.change()						sets another image (or collection of images in case of a sprite_one_of_many).
	.get_image()					returns the image to draw (it has .getCanvas())
	.globalAlpha					the alpha value to use for drawing the sprite image. usually 1.
	.globalCompositeOperation		the canvas composite operation to use for drawing the sprite image. usually "source-over" or "lighter".
	.draw()							draws the sprite into a canvas with the hotspot positioned at the sprite's current position
	.pos_offset						A { x, y } offset by which the sprite will be drawn moved.
									Notice, the offsetting is applied *after* the image has been rotated, because if you need it before,
									you can do that by adjusting the hotspot, e.g. using the hot_offset function.
	.hot_offset						A { x, y } to adjust the sprite's hotspot point.
									That is, the offsetting is applied *before* the image is being rotated.

	and following some methods/properties which only some sprite classes may contain,
	maybe even a sprite class has one of these methods/properties (so being non-null) only at specific circumstances.

	.select_clip()
	.select_circular()
	.select_next_circular()
	.enable_rotation()

	SpriteCollection

	SpriteFactory					use .create() to create a new sprite
									or .apply_to() to apply the factory to an already existing sprite (to change its image set).

	Image format:
	The image object(s) expected by sprites has to follow the image media pattern returned by
	kor.ImageLoader from kor.media.js library.

==========================================
*/

	//! single sprite. contains one image.
	kor.sprite = function( spritekind, image, z_index, globalAlpha, globalCompositeOperation, use_rotation, pos_offset, hot_offset )
	{
		this.image = image;					// image media
		this.pos = { x: 0, y: 0 };			// position of the hotspot in the scene
		this.visible = false;
		this.collision_radius = this.image.collision_radius;
		this.spritekind = spritekind;
		this.z_index = z_index;
		this.scale = 1;
		this.globalAlpha = globalAlpha != null ? globalAlpha : 1;
		this.globalCompositeOperation = globalCompositeOperation != null ? globalCompositeOperation : "source-over";
		this.pos_offset = pos_offset;
		this.hot_offset = hot_offset || { x: 0, y: 0 };

		this.get_image = function()
		{
			return this.image;
		}

		this.change = function( image )
		{
			this.image = image;
			this.collision_radius = this.image.collision_radius;
		}

		this.enable_rotation = function( en )
		{
			this.select_circular = en || en == null ?
				function ( sel )
				{
					this.rot = -sel * kor.Vec.twoPI;	// set rotation angle (oriented clockwise, in radian)
				} :
				null;
		}

		this.count = function()
		{
			return 1;
		}

		this.get_pos = function()
		{
			return this.pos;
		}

		this.set_pos = function( x, y, s )
		{
			this.pos.x = x;
			this.pos.y = y;
			if( s != null ) this.scale = s;
		}

		this.is_visible = function()
		{
			return this.visible;
		}

		this.show = function( bShow )
		{
			this.visible = bShow;
		}

		//! draws the sprite at its current position
		//! @param ctx must be the 2d context of a canvas
		this.draw = function( ctx )
		{
			if( this.is_visible() )
			{
				var source_canvas = this.image.getCanvas();
				if( source_canvas )
				{
					ctx.save();
					ctx.globalAlpha = this.globalAlpha;
					ctx.globalCompositeOperation = this.globalCompositeOperation;

					ctx.translate(
						this.pos.x,
						this.pos.y
					);

					if (this.pos_offset)
						ctx.translate(
							this.pos_offset.x * this.scale,
							this.pos_offset.y * this.scale
						);

					if (this.rot)
						ctx.rotate( this.rot );

					if (this.sub_rot)
						ctx.rotate( this.sub_rot );

					// Notice, it is maybe slightly faster not to call scale(scale,scale) and transform(-x_hot,-y_hot)
					// but integrate that just in the drawImage() call.
					// Anyway, in firefox, scale(0, 0) seems to stuck rendering (e.g. when a ship wants to warp in).
					// So if you are using ctx.scale() and you have a scale value of 0, do not call scale() but skip the drawImage() call instead.

					ctx.drawImage(
						source_canvas,
						-(this.image.x_hot + this.hot_offset.x) * this.scale,
						-(this.image.y_hot + this.hot_offset.y) * this.scale,
						this.image.width * this.scale,
						this.image.height * this.scale
					);
					ctx.restore();
				}
			}
		}

		if( use_rotation )
			this.enable_rotation( true );
	}

	kor.sprite_dummy = function( spritekind )
	{
		this.collision_radius = 0;
		this.spritekind = spritekind == null ? -1 : spritekind;
		this.get_image = function() { return null; }
		this.change = function( image ) {  }
		this.get_pos = function() { return null; }
		this.set_pos = function( x, y, s ) {  }
		this.is_visible = function() { return false; }
		this.show = function( bShow ) {  }
		this.count = function() { return 1; }
		this.globalAlpha = 1;
		this.globalCompositeOperation = "source-over";
		this.draw = function( ctx, xoffset, yoffset ) {  }
	}

	//! A sprite which actually contains a set of sprites where only one is active at any point of time.
	/*!
		@remarks
		In fact, the implementation does not create multiple sprite objects, one per image.
		Instead, animation will be performed by updating the single sprite object contained.

		@param images
		0-based, indexed collection of image media objects to load.
		If null, no images are preloaded. The object has no sprites then.
	*/
	kor.sprite_one_of_many = function( spritekind, images, z_index, globalAlpha, globalCompositeOperation, use_subrotation, pos_offset, hot_offset )
	{
		this.sel = 0;				// current selection 0 - 1
		this.i_sel = 0;				// current selection index
		this.pool = null;
		this.spritekind = spritekind;
		this.z_index = z_index;
		this.scale = 1;
		this.globalAlpha = globalAlpha != null ? globalAlpha : 1;	// we ignore globalAlpha of the sub-sprites
		this.globalCompositeOperation = globalCompositeOperation != null ? globalCompositeOperation : "source-over";	// we ignore globalCompositeOperation of the sub-sprites
		this.images = images;		// indexed collection of image media objects
		this.linear_selection_filter = function( sel ) { return sel; }
		this.reciprocal_linear_selection_filter = function( sel ) { return sel; }
		this.use_subrotation = use_subrotation;
		this.pos_offset = pos_offset;
		this.hot_offset = hot_offset;

		this.sprite = new kor.sprite( this.spritekind, this.images[this.i_sel], this.z_index, this.globalAlpha, this.globalCompositeOperation, null, this.pos_offset, this.hot_offset );
		this.collision_radius = this.sprite.collision_radius;

		this.get_image = function()
		{
			return this.sprite.get_image();
		}

		//! Changes the image set to another. They need not have equal number of images.
		/*!
			This implementation is fast since it needs to change only one sprite, namely the active one.
			High speed is necessary because it was used for flickering the player ship's flames. (Now the flames are not a sprite_one_of_many anymore since we support rotated drawing).
		*/
		this.change = function( images )
		{
			this.images = images;

			if( this.i_sel < this.images.length )
			{
				if( this.sprite == null )
					this.sprite = new kor.sprite( this.spritekind, this.images[this.i_sel], this.z_index, this.globalAlpha, this.globalCompositeOperation, null, this.pos_offset, this.hot_offset );
				else
					this.sprite.change( this.images[this.i_sel] );

				this.collision_radius = this.sprite.collision_radius;
			}
			else
				this.select_by_index( 0 );
		}

		this.count = function()
		{
			return this.images.length;
		}

		//! @param sel A selection in range [0, 1)
		//! If exceeding the range, it will be clipped to the range.
		this.select_clip = function( sel )
		{
			this.sel = sel;
			if( this.sel < 0 ) this.sel = 0;
			else if( this.sel > 1 ) this.sel = 1;

			sel = this.linear_selection_filter( sel );
			if( sel < 0 ) sel = 0;
			else if( sel > 1 ) sel = 1;

			var index = Math.round( sel * this.images.length );
			if( index < 0 ) index = 0;
			else if( index >= this.images.length ) index = this.images.length - 1;

			this.sub_rot = null;

			if( this.i_sel !== index )
			{
				this.sprite.change( this.images[this.i_sel = index] );
				this.sprite.sub_rot = this.sub_rot;
				this.collision_radius = this.sprite.collision_radius;
			}
		}

		//! \param sel A selection in range [0, 1)
		//! If exceeding the range, it will be treated round robin (circular).
		this.select_circular = function( sel )
		{
			this.sel = sel;
			this.sel = (this.sel + 1000.0) % 1.0;

			sel = (this.linear_selection_filter( sel ) + 1000.0) % 1.0;

			var index = Math.round( sel * this.images.length ) % this.images.length;

			if (this.use_subrotation)
				this.sub_rot = (index / this.images.length - sel) * kor.Vec.twoPI;

			if( this.i_sel !== index )
			{
				this.sprite.change( this.images[this.i_sel = index] );
				this.collision_radius = this.sprite.collision_radius;
			}

			if (this.use_subrotation)
				this.sprite.sub_rot = this.sub_rot;
		}

		this.select_next_circular = function()
		{
			this.select_by_index( (this.i_sel + 1) % this.images.length );
		}

		this.select_by_index = function( index )
		{
			if( index < 0 ) index = 0;
			else if( index >= this.images.length ) index = this.images.length - 1;

			this.sub_rot = null;

			if( this.i_sel !== index )
			{
				this.sel = this.reciprocal_linear_selection_filter( index / (this.images.length - 1) );
				this.sprite.change( this.images[this.i_sel = index] );
				this.collision_radius = this.sprite.collision_radius;
			}

			this.sprite.sub_rot = this.sub_rot;
		}

		this.get_pos = function()
		{
			return this.sprite.get_pos();
		}

		this.set_pos = function( x, y, s )
		{
			this.sprite.set_pos( x, y, s );
			if( s != null ) this.scale = s;
		}

		this.is_visible = function()
		{
			return this.sprite.is_visible();
		}

		this.show = function( bShow )
		{
			this.sprite.show( bShow );
		}

		//! draws the sprite at its current position
		//! @param ctx must be the 2d context of a canvas
		this.draw = function( ctx )
		{
			this.sprite.draw( ctx );
		}
	}

	//! A sprite collection, ordered by z-index.
	kor.SpriteCollection = function()
	{
		this.sprites = [];

		/*!
			@remarks
			This method does *not* check if the sprite is already in the collection
			and therefore would add it a 2nd time. You have to make sure not to cause that.
		*/
		this.add = function( sprite )
		{
			(this.sprites[sprite.z_index] || (this.sprites[sprite.z_index] = [])).push( sprite );
		}

		this.remove = function( sprite )
		{
			if( this.sprites[sprite.z_index] )
			{
				var i = this.sprites[sprite.z_index].indexOf( sprite );
				if( i >= 0 )
					this.sprites[sprite.z_index].splice( i, 1 );
			}
		}

		//! @param fn Function ( sprite ) to be called for each sprite.
		this.foreach = function( fn )
		{
			for( var z_index in this.sprites )
			{
				var coll = this.sprites[z_index];
				if( coll )
					for( var i in coll )
					{
						var sprite = coll[i];
						fn( sprite );
					}
			}
		}
	}

	/*!
		@param selection
		it may be either
		 -	single image filename / or a single image media object
		 -	array of image filenames / or of image media objects / or mixture of them
		 -	a json { pre, post, start, last, step, min_digits } to define a set of image filenames. for more, see contained function make_numbered_string()
		 -	a json defining a composition command tree as passed to kor.ImageCompositor.compose().
			The .resource member of each "get" operation there has to be one of any of the other possible, above mentioned formats described in this list.

		@param imageLoader [optional]
		A kor.ImageLoader from kor.media.js library.
		It is required only if the "selection" somewhere contains filenames.
		If only image media objects are passed, the imageLoader is ignored and may then be null.
		Notice, the imageLoader will be used to get only preloaded images. If our imageLoader does not have loaded the images yet
		(not even instructed to do so), then be sure to do so before using here.

		@param linear_selection_filter				Useful only for sprites with multiple images (sprite_one_of_many). see remarks.
		@param reciprocal_linear_selection_filter	Useful only for sprites with multiple images (sprite_one_of_many). see remarks.

		@param globalAlpha					global alpha value for drawing sprite images. usually 1.
		@param globalCompositeOperation		composite operation for drawing sprite images. usually "source-over" or "lighter".

		@param use_rotation
		Set this to true for a single sprite which then will be rotated by a call to its select_circular() method.

		@param use_subrotation
		This is used only for sprite_one_of_many to make a smooth transition between 2 images in a way by rotating each one slightly.
		Of course, this makes sense only for sprite_one_of_many whose set of images imitates a 360 degree rotation.

		@param pos_offset
		A { x, y } offset by which the sprite will be drawn moved.

		@param hot_offset
		A { x, y } to adjust the sprite's hotspot when the sprite is drawn.

		@remarks
		Usage:
			use .create() to create a new sprite
			or .apply_to() to apply the factory to an already existing sprite.

		@remarks
		A sample for linear_selection_filter and reciprocal_linear_selection_filter might be
		function( sel ) { return sel * 2.0; } and
		function( sel ) { return sel * 0.5; } respectively.
		These ones will ensure the list of sprite images in a sprite_one_of_many to be cycled twice
		instead of just once when running a selection from 0 to 1 (as passed to select_circular()).
		You would use that if the set of images reflects a rotation and the image rotated at 180 degrees is
		the same as the one at 0 degrees. Since the first 180 degrees rotation is the same like the 2nd one,
		just half of the sprite images are necessary. For the rotation to support both, the 1st
		as well as the 2nd 180 degrees rotation, these 2 methods will do the job.

		@remarks
		A word on image composition used when the selection parameter is a json defining a composition command tree:
		In that case, the kor.SpriteFactory class defines some extra properties for some of the kor.ImageCompositor's commands:
		 -	"get" command:
			A function member .adjust_index as function( index ) returning the adjusted index to use when one sprite
			is generated of all the sprites to generate for the SpriteFactory's sprite_one_of_many.
		 -	"transform" command:
			The SpriteFactory will use the .rotate_fn to return the rotation angle for a specific sprite generated
			of all the sprites to generate for the SpriteFactory's sprite_one_of_many.
	*/
	kor.SpriteFactory = function(
							spritekind,
							selection,
							z_index,
							imageLoader,
							linear_selection_filter,
							reciprocal_linear_selection_filter,
							globalAlpha,
							globalCompositeOperation,
							use_rotation,
							use_subrotation,
							pos_offset,
							hot_offset
						)
	{
		var that = this;

		this.spritekind = spritekind;
		this.selection = selection;
		this.z_index = (z_index || 0);

		this.globalAlpha = globalAlpha != null ? globalAlpha : 1;
		this.globalCompositeOperation = globalCompositeOperation != null ? globalCompositeOperation : "source-over";
		this.use_rotation = use_rotation || false;
		this.use_subrotation = use_subrotation || false;
		this.pos_offset = pos_offset;
		this.hot_offset = hot_offset;

		// private
		//! to make a single string with a number somewhere inside.
		/*!
			@param params
			must be a json { pre, post, start, last, step, min_digits }
			The numbers start and last may not be negative.
			Everything except start and last is optional.
		*/
		function make_numbered_string( params, nIndex )
		{
			var pre = params.pre || "";
			var post = params.post || "";
			var step = params.step || 1;

			var n = params.start + step * nIndex;
			if( n < 0 || n > params.last )
				return null;		// out of range

			var sn = n.toString();

			while( params.min_digits && sn.length < params.min_digits )
				sn = "0" + sn;		// negative numbers not supported anyway

			return pre + sn + post;
		}

		// private
		this.loadImage = function( name )
		{
			var media = imageLoader.get( name );	// gets only an already loaded image
			media.getCanvas();						// we want resources be pre-created and not bit by bit during the game
			return media;
		}

		// private
		//! @param selection like for .getImages() or the ctor, but excluding the kor.ImageCompositor command.
		this.getImage = function( selection, nImageIndex )
		{
			if( selection.start != null && selection.last != null )
			{
				// json as range of images
				var name = make_numbered_string( selection, nImageIndex );
				return name ? this.loadImage( name ) : null;
			}

			var image;
			if( selection instanceof Array )
			{
				// an array of images or image names
				if( nImageIndex < 0 || nImageIndex >= selection.length )
					return null;
				image = selection[nImageIndex];		// name or image media
			}
			else
			{
				// single image
				if( nImageIndex !== 0 )
					return null;
				image = selection;					// name or image media
			}

			if( typeof image === "string" )		// note, instanceof String does not work
				image = this.loadImage( image );

			return image;
		}

		// private
		this.getImages = function( selection )
		{
			var image_or_arr = [];

			if (selection.op)
			{
				// We have a kor.ImageCompositor command.
				// We do not know yet if we have to get just a single image or an array.
				// So let's start with index 0 and during processing of the first image, we will see if we will have to process more images.
				// Actually .getImage() shall return null if index out of range.
				// Notice:
				// We expect the images returned by .loadImage() and .getImage() to always be the same object when
				// we would call .loadImage() and .getImage() multiple times, respectively.
				// Especially for the loading-finished callback handling we need that.
				var data =
				{
					nImageIndex: 0
				};
				var imageCompositor = new kor.ImageCompositor(
					function( resource, command, imageCompositor )
					{
						var index = command.adjust_index ? command.adjust_index( data.nImageIndex ) : data.nImageIndex;	// SpriteFactory supports a function member .adjust_index for the kor.ImageCompositor's "get" command
						return that.getImage( resource, index );
					},
					data
				);

				while (true)
				{
					var image = imageCompositor.compose( selection );
					if( !image )
						break;
					image_or_arr.push( image );
					++data.nImageIndex;
				}
			}
			else
			{
				var nImageIndex = 0;
				while (true)
				{
					var image = this.getImage( selection, nImageIndex );
					if (!image)
						break;
					image_or_arr.push( image );
					++nImageIndex;
				}
			}

			if (image_or_arr.length === 1)
				image_or_arr = image_or_arr[0];

			return image_or_arr;
		}

		//! Creates a new sprite object.
		this.create = function()
		{
			if( this.is_one_of_many )
			{
				var spr = new kor.sprite_one_of_many( this.spritekind, this.image_or_arr, this.z_index, this.globalAlpha, this.globalCompositeOperation, this.use_subrotation, this.pos_offset, this.hot_offset );
				if( linear_selection_filter ) spr.linear_selection_filter = linear_selection_filter;
				if( reciprocal_linear_selection_filter ) spr.reciprocal_linear_selection_filter = reciprocal_linear_selection_filter;
				return spr;
			}

			return new kor.sprite( this.spritekind, this.image_or_arr, this.z_index, this.globalAlpha, this.globalCompositeOperation, this.use_rotation, this.pos_offset, this.hot_offset );
		}

		//! Applies this factory to an already existing sprite, to change its image or its image set.
		/*!
			@remarks Notice, this works only if the old and the new sprite factory either both
			are to create single sprite objects or sprite_one_of_many, but not mixed.

			@remarks E.g. it is used to make the ship flames flickering by toggling between
			different image sets.
		*/
		this.apply_to = function( sprite )
		{
			sprite.spritekind = this.spritekind;
			sprite.change( this.image_or_arr );
		}

		this.image_or_arr = this.getImages( this.selection );		// this is either a single image media object, or an array of image media objects
		this.is_one_of_many = this.image_or_arr instanceof Array;

		//! Returns the only one or the first image used by the sprites created by this factory.
		//! This is useful if you want just to retrieve informations from it like collision_radius.
		this.get_first_image = function()
		{
			return this.is_one_of_many ? this.image_or_arr[0] : this.image_or_arr;
		}
	}

	kor.SpriteDummyFactory = function()
	{
		this.create = function()
		{
			return new kor.sprite_dummy;
		}

		this.apply_to = function( sprite )
		{  }

		var s = new kor.sprite_dummy;
		this.image_or_arr = s;
		this.is_one_of_many = false;

		this.get_first_image = function()
		{
			return s;
		}
	}
