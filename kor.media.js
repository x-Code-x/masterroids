/*
kor.media.js
version 1.0


A library with means for loading and manipulating medias like images and sounds.


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

kor.core.js
	kor.Delegate
	kor.Path

kor.calc.js
	kor.Rect
*/

var kor;
if (!kor) kor = {};



/*
=======================================================

	Media loader API

	MediaRetrieverEasy			is a helper class to ease retrieving and loading of media resources.
								It uses MediaLoader.
								In principal you sould not need to access MediaLoader yourself at all.

	MediaRetrieverEasy.get		gets or loads a media resource.
								If we are in preloading mode, this will just schedule the media for preload
								otherwise it will retrieve the loaded one or queue for loading immediately.
								Which the best method is depends on the media type and this method will
								decide on that.

	MediaLoader					loads media resources.

								It supports the following mediatypes:
								- "image"
								- "audio"

	MediaLoader.retrieve		retrieves a single loaded media.
								Queues it for load if not yet already loaded or queued.
								This is desireable for medias where only one instance of a media is
								needed at all (like images).
								(Not desireable for HTML5 audio resources).

	MediaLoader.queue_media		Always queues a new instance of the desired media for load,
								regardless if there are other instance of this media loaded or loading already.
								(Preferred way for HTML5 audio resources that have not yet been preloaded).

	MediaLoader.add_request		adds request to load a media. Used to do preloading.
	MediaLoader.load_requested	queues all requested medias for loading. To realize preloading.

	A media object consists at minimum of { src, mediatype, loaded } plus the html element object depending on mediatype.
	An image media consists at minimum of { src, mediatype, loaded, elImage, getCanvas() }.

	Notice, kor.MediaLoader requires class kor.Delegate.

=======================================================
*/

	kor.MediaRetrieverEasy = function( mediaLoader )
	{
		this.mediaLoader = mediaLoader;
		this.preloadMode = true;
		this.single_instances_requested = [];		// map of media resources requested for loading, but only those where we need only one instance of (e.g. images)

		//! Gets a media. When returned, it will most likely not have been initialized yet if we are in preload mode.
		/*!
			@param obj
			{ src, mediatype, onload, onerror }
		*/
		this.get = function( obj )
		{
			var bSingleInstancePerMedia = obj.mediatype === "image";

			if( this.preloadMode )
			{
				if( bSingleInstancePerMedia )
				{
					var media = this.single_instances_requested[obj.src];
					if( media )
						return media;
				}

				return this.mediaLoader.add_request( obj );
			}

			return bSingleInstancePerMedia ?
				this.mediaLoader.retrieve( obj ) :
				this.mediaLoader.queue_media( obj );
		}

		//! Preloads all requested medias now and leaves preload mode.
		/*!
			@param progressParams
			{ onload, onerror, onfinish } with call signatures onload( media, percent ), onerror( media, percent ), onfinish()
		*/
		this.preload = function( progressParams )
		{
			this.preloadMode = false;
			this.mediaLoader.load_requested( progressParams );
			this.single_instances_requested = [];
		}
	}

	kor.MediaLoader = function()
	{
		var that = this;

		this.requested = [];		// indexed array of media resources requested for loading or that have been loaded already. an item contains { src, mediatype, onload, onerror, media } where media is already the prepared media object but of course with nothing loaded yet
		this.queued = [];			// map of indexed arrays of resources queued for loading, so which are currenly loading
		this.loaded = [];			// map of indexed arrays of resources finished loading successfully
		// Notice, a map of indexed arrays is a [] map where the key is a media src and the value is an indexed [] array.
		// Therefore, an entry in the map can have multiple instances of the same media.
		this.count_queued = 0;		// how many are queued and still loading
		this.count_loaded = 0;		// how many are successfully loaded that we still remember
		this.count_errors = 0;

		this.dummyCanvas = document.createElement("canvas");

		//! Adds a request to load a media { src, mediatype, onload, onerror }. This means scheduling for preload.
		//! It will request loading another instance of the media regardless if there are others loaded or requested for loading already.
		/*!
			@param obj
			{ src, mediatype, onload, onerror }

			@return
			the media object, but without anything set yet. It will get initialized
			once it gets queued and it will be finalized when loading finished.
		*/
		this.add_request = function( obj )
		{
			obj.media = {};
			this.requested.push( obj );
			return obj.media;
		}

		//! Queues all requested medias for loading. This means preloading all requested medias.
		/*!
			@param progressParams
			[optional]
			{ onload, onerror, onfinish } with call signatures onload( media, percent ), onerror( media, percent ), onfinish().
			onload is called when one media was loaded successfully,
			onerror is called when a media loading failed,
			onfinish is called when loading all requested medias has ended.
		*/
		this.load_requested = function( progressParams )
		{
			this.count_loaded = 0;	// we reset the progress value
			this.count_errors = 0;

			for( var i = 0 ; i < this.requested.length ; ++i )
				this.queue_media( this.requested[i], this.requested[i].media, progressParams )

			this.requested = [];
		}

		//! Retrieves a single loaded media { src, mediatype, onload, onerror }.
		//! Queues it for load if not yet already loaded or queued.
		/*!
			Notice, does not wait for loading having finished.

			This is desireable for medias where only one instance of a media is
			needed at all (like images).

			You will not want to use this for audio resources
			because a HTML5 audio resource cannot play multiple instances of its sound at the same time.

			@param obj
			{ src, mediatype, onload, onerror }

			@return
			the media object

			@remarks
			There might be more than one instances of the desired media
			having been loaded or queued. In that case this method returns
			the first one loaded successfully, otherwise it returns the first
			one in the queue, or if neither exists, a new one is queued and returned.
		*/
		this.retrieve = function( obj )
		{
			var media = null;

			// get the first loaded one we can find
			var sublist = this.loaded[obj.src];
			if( sublist && sublist[0] ) return sublist[0];

			// else we look if one is queued already
			sublist = this.queued[obj.src];
			if( sublist && sublist[0] ) return sublist[0];

			return this.queue_media( obj );
		}

		//! Always queues a new instance of the desired media for load,
		//! regardless if there are other instance of this media loaded or loading already.
		/*!
			Notice, does not wait for loading having finished.

			You will want to use this for audio resources that have not been preloaded
			because a HTML5 audio resource cannot play multiple instances of its sound at the same time.

			@param obj
			{ src, mediatype, onload, onerror }

			@param media
			[optional]
			A prepared media object to be filled. You will usually pass null here.
			This param is intended mainly for internal use.

			@param progressParams
			[optional]
			mainly used by load_requested() when to call events regarding progress of loading multiple requested medias.

			@return
			the new media object (or the passed input media object if one was passed)
			A media object consists at minimum of { src, mediatype, loaded, finished, when } plus the html element object depending on mediatype.
			An image media consists at minimum of { src, mediatype, loaded, finished, when, elImage, getCanvas() }.
			With
			- when		being the time the media finished loading (successfully or with failure)
			- loaded	true if loaded successfully, false if not yet finished loading or if finished with failure
			- finished	true if loading finished, regardless if successfully or with failure (which is indicated by .loaded)
		*/
		this.queue_media = function( obj, media, progressParams )
		{
			if( !media ) media = {};
			media.src = obj.src;
			media.mediatype = obj.mediatype;
			media.onload = new kor.Delegate( obj.onload );		// notice, the delegate will be set to null when loading finished (to release objects in the functions's closures)
			media.onerror = new kor.Delegate( obj.onerror );	// notice, the delegate will be set to null when loading finished (to release objects in the functions's closures)
			media.loaded = false;		// indicates if the media has been completely loaded successfully
			media.finished = false;
			media.when = 0;
			media.progressParams = progressParams;

			(this.queued[media.src] || (this.queued[media.src] = [])).push( media );
			++this.count_queued;

			media.subqueue_index = this.queued[media.src].length - 1;

			switch( media.mediatype )
			{
				case "image":
					if( media.subqueue_index === 0 )
					{
						media.elImage = new Image;
						media.elImage.Media = media;	// add .Media so that we can access the first media object of the array in the event handlers. Notice, we create a cyclic dependency by this, but only as long as loading is not finished.
						media.elImage.onload = this.OnLoadedAll;
						media.elImage.onerror = this.OnErrorAll;
						media.elImage.src = media.src;
						document.body.appendChild( media.elImage );
					}
					else
						media.elImage = this.queued[media.src][0].elImage;		// for all medias of same image file, we just use a single DOM Image.

					media.elCanvas = null;

					//! This method on an image media will get or create the image as canvas.
					//! @return dummyCanvas if not yet completely loaded
					media.getCanvas = function()
					{
						if( this.elCanvas )
							return this.elCanvas;

						if( !this.loaded )
							return that.dummyCanvas; //null;	// we return a valid canvas so that we can continue drawing without error

						this.elCanvas = document.createElement("canvas");
						this.elCanvas.src = this.elImage.src;
						this.elCanvas.width = this.elImage.width;
						this.elCanvas.height = this.elImage.height;

						var ctx = this.elCanvas.getContext("2d");
						ctx.drawImage(this.elImage, 0, 0, this.elImage.width, this.elImage.height);

						return this.elCanvas;
					}
					break;

				case "audio":
					media.elAudio = new Audio();
					media.elAudio.Media = media;		// add .Media so that we can access the media object in the event handlers. Notice, we create a cyclic dependency by this, but only as long as loading is not finished.
					//media.elAudio.preload = "auto";	// setting preload to none does not help
					media.elAudio.autoplay = false;
					media.elAudio.loop = false;
					media.elAudio.addEventListener("canplay", this.OnLoaded, false);
					media.elAudio.addEventListener("error", this.OnError, false);
					media.elAudio.src = media.src;
					media.elAudio.load();
					break;
			}

			return media;
		}

		this.OnLoaded = function( e )
		{
			var media = this.Media;
			this.Media = null;

			(that.loaded[media.src] || (that.loaded[media.src] = [])).push( media );	// set as loaded
			that.queued[media.src].splice( media.subqueue_index, 1 );					// remove from queue
			++that.count_loaded;
			--that.count_queued;

			media.loaded = true;
			media.finished = true;
			media.when = (new Date()).getTime();

			that.cleanup_media( media );

			kor.Delegate.invoke( media.onload );

			that.finalization( media, true );
		}

		this.OnLoadedAll = function( e )
		{
			var src = this.Media.src;
			this.Media = null;

			var medias = that.loaded[src] = that.queued[src];
			that.queued[src] = [];
			that.count_loaded += medias.length;
			that.count_queued -= medias.length;

			for( var i in medias )
			{
				var media = medias[i];
				media.loaded = true;
				media.finished = true;
				media.when = (new Date()).getTime();

				that.cleanup_media( media );

				kor.Delegate.invoke( media.onload );

				that.finalization( media, true );
			}
		}

		this.OnError = function( e )
		{
			var media = this.Media;
			this.Media = null;

			that.queued[media.src].splice( media.subqueue_index, 1 );		// remove from queue
			++that.count_errors;
			--that.count_queued;

			media.finished = true;
			media.when = (new Date()).getTime();

			that.cleanup_media( media );

			kor.Delegate.invoke( media.onerror );

			that.finalization( media, false );
		}

		this.OnErrorAll = function( e )
		{
			var src = this.Media.src;
			this.Media = null;

			var medias = that.queued[src];
			that.queued[src] = [];
			that.count_errors += medias.length;
			that.count_queued -= medias.length;

			for( var i in medias )
			{
				var media = medias[i];
				media.finished = true;
				media.when = (new Date()).getTime();

				that.cleanup_media( media );

				kor.Delegate.invoke( media.onerror );

				that.finalization( media, false );
			}
		}

		this.cleanup_media = function( media )
		{
			switch( media.mediatype )
			{
				case "audio" :
					media.elAudio.removeEventListener("canplay", that.OnLoaded, false);
					media.elAudio.removeEventListener("error", that.OnError, false);
					break;
			}
		}

		this.finalization = function( media, bLoadedSuccessfully )
		{
			// we remove the delegates completely. that way, dependent functions and objects (in the functions's closures) will be released finally
			media.onload = null;
			media.onerror = null;

			var percent = 100 * (that.count_loaded + that.count_errors) / (that.count_loaded + that.count_errors + that.count_queued);
			var finished = that.count_queued === 0;

			if( media.progressParams )
			{
				if( bLoadedSuccessfully && media.progressParams.onload )
					media.progressParams.onload( media, percent );
				else
				if( !bLoadedSuccessfully && media.progressParams.onerror )
					media.progressParams.onerror( media, percent );

				if( finished )
					media.progressParams.onfinish( that );
			}
		}
	}



/*
=======================================================

	HTML5 Audio API

	Sound				The sound object is bound to a single sound file
						and can play() multiple instances of the file simultaneously,
						each one using an own HTML5 audio element.

						play() to start playing a (new) instance of the sound file

						stop() to stop the sound if that is supported by the specific object

	SoundFactory		Gets or creates sound objects, one for each sound filename.
						As long as the mediaRetriever is in preloadMode == true, you
						can call get() to schedule a sound for preload.
						They will be loaded once you call mediaRetriever.preload() manually.

=======================================================
*/

	kor.Sound = function(
					mediaRetriever,		//!< a MediaRetrieverEasy
					src,				//!< the sound file (usually an mp3 or wav) to play
					prefetch_count,		//!< [optional] how many audio elements should be prepared with this sound already. (default = 2)
					max_count			//!< [optional] how many audio elements at maximum this sould object may create. (default = prefetch_count + 1)
				)
	{
		this.mediaRetriever = mediaRetriever;
		this.medias = [];
		this.max_count = max_count;

		// HTML5 audio methods and properties described in https://developer.mozilla.org/En/XPCOM_Interface_Reference/NsIDOMHTMLMediaElement

		this.fetch = function( src )
		{
			this.medias.push( this.mediaRetriever.get({ src: src, mediatype: "audio" }) );
		}

		if( prefetch_count == null )
			prefetch_count = 1;

		if( this.max_count == null )
			this.max_count = prefetch_count + 1;

		for( var i = 0 ; i < prefetch_count ; ++i )
			this.fetch( src );

		//! Start playing the sound.
		this.play = function()
		{
			for( var i in this.medias )
			{
				var m = this.medias[i];
				if( m.elAudio &&
					(m.elAudio.ended || m.elAudio.paused) )
				{
					m.elAudio.play();
					// now we resort the array so that the oldest one played is at the front.
					this.medias.splice( i, 1 );
					this.medias.push( m );
					return;
				}
			}

			if( this.medias.length >= this.max_count )
			{
				// may not create new audio element here. so let's just stop and restart the first one which is the oldest one played since we resort the array.
				var m = this.medias[0];
				if( m.elAudio )
				{
					try { m.elAudio.currentTime = 0; }
					catch( e ) {  }
					m.elAudio.play();
				}
				return;
			}

			this.fetch( this.medias[0].src );
		}

		//! @remarks Cannot stop single-shot sound.
		this.stop = function()
		{  }
	}

	//! @remarks to emulate loop (e.g. for Firefox), we manually restart the audio once it ended.
	// TODO If once we make e.g. snd_thrust looping, snd_thrust first has to be treated differently, namely one for each FO. And 2nd playing SoundLooping's have to be paused when game paused and continued afterwards.
	kor.SoundLooping = function(
							mediaRetriever,		//!< a MediaRetrieverEasy
							src					//!< the sound file (usually an mp3 or wav) to play
					   )
	{
		var that = this;

		this.mediaRetriever = mediaRetriever;
		this.canLoop = navigator.userAgent.search(/msie/i) >= 0;
		this.emulateLoop = !this.canLoop;
		this.media = this.mediaRetriever.get({ src: src, mediatype: "audio" });

		if( this.media.elAudio )
		{
			this.media.elAudio.loop = !this.emulateLoop;
			if( this.emulateLoop )
				this.media.elAudio.addEventListener(
					"ended",
					function()
					{
						try { this.currentTime = 0; }
						catch( e ) {  }
					},
					false
				);
		}

		//! Start playing the sound.
		this.play = function()
		{
			if( this.media.elAudio &&
				(this.media.elAudio.ended || this.media.elAudio.paused) )
			{
				this.media.elAudio.play();
			}
		}

		this.stop = function()
		{
			if( this.media.elAudio )
			{
				try { this.media.elAudio.currentTime = 0; }
				catch( e ) {  }
				this.media.elAudio.pause();
			}
		}
	}

	//! A wrapper that limits the possible number of play() calls.
	/*!
		We use that for a sound we want just to be played once per frame.
		So at the beginning of every frame step, we reset the .amount to 1.

		@param amount
		[optional]
		set this to the amount of play() calls you want to allow
		default = 1

		@param period
		[optional]
		time duration [ms] where the amount is valid.
		1 if it should be valid just for the current frame.
		default = 50
	*/
	kor.SoundLimiter = function( sound, amount, period )
	{
		this.sound = sound;
		this.amount = (amount || 1);
		this.remaining = this.amount;
		this.period = (period || 50);
		this.time_stamps = [];

		this.play = function()
		{
			var t = (new Date()).getTime();
			while( this.time_stamps.length > 0 && t - this.time_stamps[0] > this.period )
				this.time_stamps.splice( 0, 1 );

			if( this.time_stamps.length < this.amount )
			{
				this.sound.play();
				this.time_stamps.push( t );
			}
		}

		this.stop = function()
		{
			this.sound.stop();
		}
	}

	kor.SoundFactory = function( mediaRetriever, basepath )
	{
		this.mediaRetriever = mediaRetriever;
		this.canMP3 = navigator.userAgent.search(/gecko|firefox|opera/i) < 0;
		this.snd_ext = this.canMP3 ? "mp3" : "wav";
		this.sounds = [];
		this.basepath = basepath;

		//! Get or create a singular sound object for the sound filename.
		/*!
			@param sndname
			A sound filename including path, but *without* extension.
		*/
		this.get = function( sndname, bLoop )
		{
			if( bLoop )
				return new kor.SoundLooping(
					this.mediaRetriever,
					(!kor.Path.isUrlAbsolute(sndname) && basepath ? basepath + "/" : "") + sndname + "." + this.snd_ext
				);

			var s = this.sounds[sndname];
			if( !s )
				s = this.sounds[sndname] = new kor.Sound(
					this.mediaRetriever,
					(!kor.Path.isUrlAbsolute(sndname) && basepath ? basepath + "/" : "") + sndname + "." + this.snd_ext
				);
			return s;
		}
	}



/*
========================================================

	Image loader API

	ImageLoader			Gets or creates image media objects.
						The returned object is a media object as returned by
						the MediaRetrieverEasy, but with additional properties
						- name				to identify the image
						- width, height
						- size {x, y}
						- x_hot, y_hot		hotspot of the image
						- hot {x, y}		hotspot of the image

	Notice, ImageLoader will store the media objects it creates/returns. Like this, it can be re-retrieved using .get().
	Also the canvas element for such a image media, the media object will remember.

	ImageCompositor		use this to tint and combine several images into one.
						It only returns image medias with new canvas elements, not DOM Images.

						The command to pass for composing is a tree of command objects with an "op"
						member indicating the operation. Each operation returns a image media
						with the additional members as defined by ImageLoader.

						The following commands exist:

						Loading an image resource:
							{
								op: "get",
								resource: ...
							}
						This gets a image media from the specified resource (which will be passed to ImageCompositor's fnLoadImage to get the media object).
						IMPORTANT: If the image media object returned is null, then the whole .compose() method call will
						abort and return null, too.
						This can work e.g. as indicator for the caller when a loop over different image resources has reached its end.

						Tinting an image:
							{
								op: "tint",
								color: <base color as html color string>,
								saturation: <0 - 1 indicating how strong to paint the image over the base color>,
								source: <a command returning the source image>
							}

						Combining an array of images with the same composite operation:
							{
								op: "combine",
								globalCompositeOperation: <same as for .globalCompositeOperation of canvas element>,
								globalAlpha: <same as for .globalAlpha of canvas element>,
								sources: [<an array of commands giving the source images>]
							}

						Rotating an image around its hotspot:
							{
								op: "transform",
								[rotate_fn]: function( command, imageCompositor ) { return ...; },	which shall return the clockwise oriented rotation angle in radian. optional
								[scale]: ...														scale value. optional
								source: <a command returning the source image>
							}
						Notice, the rotation will not enlarge the image. So it is expected that the original image's visible content
						is bound by a circle fitting perfectly completely in the original image otherwise the rotation might
						cut off some visible part (depending on the actual rotation angle value).
						Maybe in future I add a bool property .adjust_canvas_size which when true would enlarge the image so that the rotated
						original image rect fits completely inside the destination canvas.

						Creating a media with a new canvas which is resized to fit within a maximum size but keeping its aspect ratio:
							{
								op: "copyCanvasResizedKeepAspectRatio",
								max_width,
								max_height,
								source: <a command returning the source image>
							}

						Notice, "copyCanvasResizedKeepAspectRatio" ensures that a new canvas element is created and returned
						regardless if the operation really had to resize or not.
						So you can add the new canvas element into the DOM if you wish.

	.compose()			The main method to create a composed image media.

						WARNING: The returned media object has *only* its canvas composed.
						The media's .elImage member might be either a non-manipulated DOM Image or just be null at all. 

						WARNING: The returned media will have an unfinished painted canvas in case any of the
						media's .loaded members is false.
						In that case, the returned media's .loaded member will be false the same.

						Also .finished member will be false if any of the source images has .finished as false.

						BUT the composed media will update itself automatically once one of its dependent source image medias
						finishes loading.

	.user_data			user data passed to the ctor

	In contrast to ImageLoader, ImageCompositor does not store the media objects it creates.
	The caller will have to do that by himself.
	That includes the fact that multiple calls to .compose() for the same command tree will
	each create its own media object being returned.

========================================================
*/

	kor.ImageLoader = function( mediaRetriever, basepath )
	{
		this.mediaRetriever = mediaRetriever;
		this.basepath = basepath;
		this.images = [];

		//! Loads an image, or gets the existing single instance, if already loaded before. returns an image media.
		/*!
			It expects the mediaRetriever to return always just the same single instance
			Image object for an image file.

			In preloading phase, performs a preloading of an image as IMG element
			in the page with style display:none
		*/
		this.load = function(
						name,				//!< any name (unique within the ImageLoader) to identify an (untinted) image object. (if you wish, it may be identical to image_filename)
						image_filename,
						width, height,
						x_hot, y_hot,		//!< [optional] hotspot coordinates
						collision_radius	//!< [optional] collision radius around the hot spot
					)
		{
			var media = this.mediaRetriever.get({ src: (!kor.Path.isUrlAbsolute(image_filename) && basepath ? basepath + "/" : "") + image_filename, mediatype: "image" });
			media.name = name;
			media.width = width;
			media.height = height;
			media.size = { x: width, y: height };
			media.x_hot = (x_hot || 0);
			media.y_hot = (y_hot || 0);
			media.hot = { x: media.x_hot, y: media.y_hot };
			media.collision_radius = (collision_radius || 0);
			this.images[name] = media;
			return media;
		}

		//! Retrieves a preloaded image. returns an image media.
		this.get = function( name )
		{
			return this.images[name];
		}
	}

	/*!
		@param fnLoadImage
		An image loader function fnLoadImage( resource, command, imageCompositor ) which receives the command.resource
		member of the "get" operation, the command itself as well as the imageCompositor object (from which you can retrieve .user_data if needed)
		and returns the loaded/retrieved image media object.

		@param user_data
		An arbitrary user data mainly to be accessed by each loading function.
		This can be accessed by ImageCompositor.user_data as long as the ImageCompositor object exists.

		The returned image media object must have the same members and requirements as the
		one returned by kor.ImageLoader class.

		@remarks
		the returned media object of the ImageCompositor will update and recalculate itself automatically
		once one of its source image medias gets updated (e.g. when a source image finished loading)
	*/
	kor.ImageCompositor = function( fnLoadImage, user_data )
	{
		var that = this;

		var fnLoadImage = fnLoadImage || (function( resource, command, imageCompositor ) { return resource; });
		this.user_data = user_data || {};

		/*!
			@param prev_result
			[optional]
			Pass here a previously returned media object by this compose call for this command.
			This is used internally to re-invoke composing in case one of the source image medias has
			finished loading later on. Because we want the re-invoked composing to return the very same
			media object so that external objects holding a reference to the composed media (like sprites)
			do not need to update their media references.
		*/
		this.compose = function( command, prev_result )
		{
// TODO firefox 6 increases memory usage (just by reloading page several times without doing anything else). maybe we need to delete temporary canvases manually? but I cannot find a way to do that.
			var collected_sources = [];
			var media = this.internal_compose( command, collected_sources, prev_result ? prev_result.getCanvas() : null );

			if (!media)
				return null;

			if (prev_result)
			{
				// Fill our previous media object and return it again.
				// We don't need to update delegates.
				prev_result.src					= media.src;
				prev_result.mediatype			= media.mediatype;
				prev_result.loaded				= media.loaded;
				prev_result.finished			= media.finished;
				prev_result.when				= media.when;
				prev_result.elImage				= media.elImage;
				prev_result.elCanvas			= media.elCanvas;
				prev_result.getCanvas			= media.getCanvas;
				prev_result.name				= media.name;
				prev_result.width				= media.width;
				prev_result.height				= media.height;
				prev_result.size				= media.size;
				prev_result.x_hot				= media.x_hot;
				prev_result.y_hot				= media.y_hot;
				prev_result.hot					= media.hot;
				prev_result.collision_radius	= media.collision_radius;

				media = prev_result;

				if (media.onload)
					media.onload.invoke();

				if (media.finished)
					media.onload = null;	// notice, we set the delegate to null when loading finished (to release objects in the functions's closures)
			}
			else
			{
				// For a new media, set the delegates for recomposing if sources are unfinished.
				var fn = function()
				{
					that.compose( command, media );
				}

				for( var i = 0, l = collected_sources.length ; i < l ; ++i )
				{
					var source = collected_sources[i];
					if (!source.finished && source.onload)
						source.onload.add( fn );
				}

				// Now add a delegate to be able to react on that.
				if (!media.finished)
					media.onload = new kor.Delegate;		// notice, the delegate will be set to null when loading finished (to release objects in the functions's closures)
				// Notice, this onload event can be invoked more than once for this media, namely when one of the source images this media depends on
				// finishes loading. Only if media.finished is true, the media is finally finished.
			}

			return media;
		}

		// private
		/*!
			@param canvas_used
			[optional]
			If not null, the operation should modify this canvas instead of creating a new one.
			It should be the canvas of a previous media returned by this very same operation.
			\n
			Only exception is the "get" command which provides the canvas the image media provides
			and then therefore ignores canvas_used.
		*/
		this.internal_compose = function( command, collected_sources, canvas_used )
		{
			switch( command.op )
			{
				case "get":
				{
					var source = fnLoadImage( command.resource, command, this );
					if (source && collected_sources && collected_sources.indexOf( source ) < 0)
						collected_sources.push( source );
					return source;
				}

				case "tint":
				{
					var source = this.internal_compose( command.source );
					return !source ? null : {
						src:		source.src,
						mediatype:	source.mediatype,
						loaded:		source.loaded,
						finished:	source.finished,
						when:		(new Date()).getTime(),
						elImage:	source.elImage,			// WARNING: elImage is *not* tinted, only the canvas is
						elCanvas:	source.loaded ? that.createTintedCanvas( source.getCanvas(), command, canvas_used ) : null,
						getCanvas:	function() { return this.elCanvas; },
						name:		source.name,
						width:		source.width,
						height:		source.height,
						size:		{ x: source.width, y: source.height },
						x_hot:		source.x_hot,
						y_hot:		source.y_hot,
						hot:		{ x: source.x_hot, y: source.y_hot },
						collision_radius:	source.collision_radius
					};
				}

				case "combine":
				{
					var media = {
						mediatype:	"image",
						loaded:		true,
						finished:	true,
						when:		(new Date()).getTime(),
						elCanvas:	null,
						getCanvas:	function() { return this.elCanvas; }
					};
					var bounds = null;
					var sources = [];

					// first calculate extents
					for( var i in command.sources )
					{
						var source = this.internal_compose( command.sources[i] );
						if( !source )
							return null;
						sources.push( source );

						media.loaded = media.loaded && source.loaded;
						media.finished = media.finished && source.finished;

						if( media.width == null )
						{
							media.width = source.width;
							media.height = source.height;
							media.size = { x: source.width, y: source.height };
							media.x_hot = source.x_hot;
							media.y_hot = source.y_hot;
							media.hot = { x: source.x_hot, y: source.y_hot };
							media.collision_radius = source.collision_radius;
							bounds = kor.Rect.offset( kor.Rect.from_size( source ), -source.x_hot, -source.y_hot );
						}
						else
						{
							var r1 = kor.Rect.offset( kor.Rect.from_size( source ), -source.x_hot, -source.y_hot );
							bounds = kor.Rect.union( bounds, r1 );
							media.size = kor.Rect.size( bounds );
							media.width = media.size.x;
							media.height = media.size.y;
							media.x_hot = -bounds.left;
							media.y_hot = -bounds.top;
							media.hot = { x: media.x_hot, y: media.y_hot };
							media.collision_radius = Math.max( source.collision_radius, media.collision_radius );	// it is that simple because the images are drawn over each other with their hotspots overlapping
						}
					}

					if( media.width == null )
						return {
							src:		null,
							mediatype:	"image",
							loaded:		false,
							finished:	false,
							when:		0,
							elImage:	null,
							elCanvas:	null,
							getCanvas:	function() { return this.elCanvas; },
							name:		null,
							width:		0,
							height:		0,
							size:		{ x: 0, y: 0 },
							x_hot:		0,
							y_hot:		0,
							hot:		{ x: 0, y: 0 },
							collision_radius:	0
						};

					var buffer = media.elCanvas = canvas_used || document.createElement("canvas");
					buffer.width = media.width;
					buffer.height = media.height;
					var ctx = buffer.getContext("2d");

					ctx.clearRect( 0, 0, buffer.width, buffer.height );
					ctx.save();

					// now draw
					for( var i in sources )
					{
						var source = sources[i];
						var srcCanvas;

						if( source.loaded && (srcCanvas = source.getCanvas()) )
						{
							var r1 = kor.Rect.offset( kor.Rect.from_size( source ), -source.x_hot, -source.y_hot );
							ctx.drawImage( srcCanvas, r1.left - bounds.left, r1.top - bounds.top );
						}

						// first image we draw with default params
						ctx.globalCompositeOperation = command.globalCompositeOperation;
						ctx.globalAlpha = command.globalAlpha;
					}

					ctx.restore();

					return media;
				}

				case "transform":
				{
					var source = this.internal_compose( command.source );
					if( !source )
						return null;

					var scale = (command.scale || 1);

					var media = {
						src:		null,
						mediatype:	"image",
						loaded:		source.loaded,
						finished:	source.finished,
						when:		(new Date()).getTime(),
						elImage:	source.elImage,			// WARNING: elImage is *not* rotated nor scaled, only the canvas is
						elCanvas:	null,
						getCanvas:	function() { return this.elCanvas; },
						name:		source.name,
						width:		Math.max(source.width * scale),
						height:		Math.max(source.height * scale),
						x_hot:		source.x_hot * scale,
						y_hot:		source.y_hot * scale,
						collision_radius:	source.collision_radius * scale
					};
					media.size	=	{ x: media.width, y: media.height };
					media.hot	=	{ x: media.x_hot, y: media.y_hot };

					var srcCanvas;

					if( source.loaded && (srcCanvas = source.getCanvas()) )
					{
						var buffer = media.elCanvas = canvas_used || document.createElement("canvas");
						buffer.width = media.width;
						buffer.height = media.height;
						var ctx = buffer.getContext("2d");

						ctx.clearRect( 0, 0, buffer.width, buffer.height );
						ctx.save();

						ctx.scale( scale, scale );
						ctx.translate( source.x_hot, source.y_hot );

						var rot = command.rotate_fn ? command.rotate_fn( command, this ) : null;
						if( rot )
							ctx.rotate( rot );

						// Notice, it is maybe slightly faster not to call scale(scale,scale) and transform(-x_hot,-y_hot)
						// but integrate that just in the drawImage() call.
						// Anyway, in firefox, scale(0, 0) seems to stuck rendering (e.g. when a ship wants to warp in).
						// So if you are using ctx.scale() and you have a scale value of 0, do not call scale() but skip the drawImage() call instead.

						ctx.drawImage(
							srcCanvas,
							-source.x_hot,
							-source.y_hot,
							source.width,
							source.height
						);

						ctx.restore();
					}

					return media;
				}

				case "copyCanvasResizedKeepAspectRatio":
				{
					var source = this.internal_compose( command.source );
					if( !source )
						return null;

					var result = this.copyCanvasResizedKeepAspectRatio( source.getCanvas(), command.max_width, command.max_height, canvas_used );

					return {
						src:		null,
						mediatype:	"image",
						loaded:		source.loaded,
						finished:	source.finished,
						when:		(new Date()).getTime(),
						elImage:	null,
						elCanvas:	result.canvas,
						getCanvas:	function() { return this.elCanvas; },
						name:		source.name,
						width:		result.size.x,
						height:		result.size.y,
						size:		result.size,
						x_hot:		source.x_hot * result.scale,
						y_hot:		source.y_hot * result.scale,
						hot:		{ x: source.x_hot * result.scale, y: source.y_hot * result.scale },
						collision_radius:	source.collision_radius * result.scale
					};
				}
			}
		}

		// private
		//! Helper method to create and return a tinted canvas of an image (but not store it in the media object).
		//! @param image a DOM Image or a canvas
		//! @param tint { color, saturation } with a base color being a html color string, and saturation a value 0 - 1 or even higher (which will render the image multiple times).
		/*!
			@param canvas_used
			[optional]
			If not null, the operation should modify this canvas instead of creating a new one.
		*/
		this.createTintedCanvas = function( image, tint, canvas_used )
		{
			// create offscreen buffer
			var buffer = canvas_used || document.createElement("canvas");
			buffer.width = image.width;
			buffer.height = image.height;
			var ctx = buffer.getContext("2d");

			ctx.clearRect( 0, 0, buffer.width, buffer.height );
			ctx.save();

			// fill offscreen buffer with the tint color
			ctx.fillStyle = tint.color;
			ctx.fillRect( 0, 0, buffer.width, buffer.height );

			ctx.globalCompositeOperation = "lighter";
			var sat = tint.saturation == null ? 1 : tint.saturation;
			for( ; sat > 0 ; --sat )
			{
				ctx.globalAlpha = sat;
				ctx.drawImage( image, 0, 0 );
			}

			// destination atop makes a result with an alpha channel identical to the DOM Image, but with all pixels retaining their original color *as far as I can tell*
			ctx.globalCompositeOperation = "destination-atop";
			ctx.globalAlpha = 1;
			ctx.drawImage( image, 0, 0 );

			ctx.restore();

			return buffer;
		}

		// private
		//! Helper that returns a new canvas element that is a resized copy of the source canvas making it as big as possible
		//! to fit inside the passed maximum size while keeping aspect ratio.
		//! @return { canvas, size, scale }
		/*!
			@param canvas_used
			[optional]
			If not null, the operation should modify this canvas instead of creating a new one.
		*/
		this.copyCanvasResizedKeepAspectRatio = function( source, max_width, max_height, canvas_used )
		{
			var buffer = canvas_used || document.createElement("canvas");
			var size = { x: source.width, y: source.height };
			var scale = 1;

			if (size.x && size.y &&
				max_width && max_height)
			{
				var aspect_ratio = size.x / size.y;

				if (size.y != max_height)
				{
					size = { x: max_height * aspect_ratio, y: max_height };
					scale = Math.ceil(size.y) / source.height;
				}
				if (size.x > max_width)
				{
					size = { x: max_width, y: max_width / aspect_ratio };
					scale = Math.ceil(size.x) / source.width;
				}

				size = { x: Math.ceil(size.x), y: Math.ceil(size.y) };
			}

			if (size.x && size.y)
			{
				buffer.width = size.x;
				buffer.height = size.y;

				var ctx = buffer.getContext("2d");
				ctx.clearRect( 0, 0, buffer.width, buffer.height );
				ctx.drawImage( source, 0, 0, size.x, size.y );
			}

			return { canvas: buffer, size: size, scale: scale };
		}
	}
