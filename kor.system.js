/*
kor.system.js
version 1.0


Some system or browser related class facilities.


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
*/

var kor;
if (!kor) kor = {};



/*
========================================================

	Device detection utilities

	Notice, they are not 100% accurate and not future-proof,
	but we just need it to detect if to display the navigation controls

========================================================
*/

	kor.DeviceDetection =
	{
		isTablet: !!navigator.userAgent.match(/(iPad|SCH-I800|xoom|kindle|ASUS)/i),

		isMobile: !!navigator.userAgent.match(/(iPhone|iPod|blackberry|android|htc|lg|midp|mmp|mobile|nokia|opera mini|palm|pocket|psp|sgh|smartphone|symbian|treo mini|Playstation Portable|SonyEricsson|Samsung|MobileExplorer|PalmSource|Benq|Windows Phone|Windows Mobile|IEMobile|Windows CE|Nintendo Wii)/i) && !this.isTablet
	}



/*
========================================================

	Cookie utilities

	JCookie				a cookie with JSON value support
						For this object to work, JSON.stringify() and JSON.parse() must exist.
						E.g. with HTML5.

	@cookie:			http://de.wikipedia.org/wiki/HTTP-Cookie#Aufbau

========================================================
*/

	//! static cookie util functions
	kor.Cookie =
	{
		//! Get the value of the cookie with the specified name.
		load: function( name )
		{
			// cookies are separated by semicolons
			var cookies = document.cookie.split("; ");
			for( var i = 0 ; i < cookies.length ; ++i )
			{
				// a name/value pair (a crumb) is separated by an equal sign
				var crumbs = cookies[i].split("=");
				if( name == crumbs[0] )
					return decodeURIComponent( crumbs[1] );
			}

			// a cookie with the requested name does not exist
			return null;
		},

		//! Set the value of the cookie with the specified name.
		store: function( name, value )
		{
			var expire_days = 365 * 10;
			var expiration_date = new Date();
			expiration_date.setDate( expiration_date.getDate() + expire_days );

			document.cookie = name + "=" + encodeURIComponent( value ) + ";expires=" + expiration_date.toGMTString();
		},

		//! Delete the cookie with the specified name.
		erase: function( name )
		{
			document.cookie = name + "=; expires=Fri, 21 Dec 1976 04:31:24 GMT;";
		}
	}

	//! a cookie with JSON value
	/*!
		@param name name of the cookie
		@param default_value [optional] if specified, will be used as default value if nothing to load yet
	*/
	kor.JCookie = function( name, default_value )
	{
		this.name = name;
		this.value = null;						//!< the json value
		this.default_value = default_value;

		this.get = function() { return this.value; }

		this.load = function()
		{
			try { var s = kor.Cookie.load( this.name ); this.value = s != null ? JSON.parse( s ) : null; }
			catch( e ) { this.value = null; }
			return this.value;
		}

		//! @param json_value [optional]
		this.store = function( json_value )
		{
			if (json_value) this.value = json_value;
			try { kor.Cookie.store( this.name, JSON.stringify( this.value ) ); }
			catch( e ) {  }
			return this.value;
		}

		this.erase = function()
		{
			try { kor.Cookie.erase( this.name ); this.value = null; }
			catch( e ) {  }
			return this.value;
		}

		this.load();

		if (this.value == null)
			this.value = default_value;
	}



/*
========================================================

	HTML5 canvas surface rendering API

	Surface					the surface object with helper methods for canvas
							It creates the canvas fullscreen on the page.

	Surface.setSize			set view size of the surface

	Surface.setDocumentSize	call this when the document window resizes to set
							the size of the surface to the complete body size

	Surface.supportsCanvas	will be false if the browser does not support HTML5 CANVAS

========================================================
*/

	kor.Surface = function( name, bAlert )
	{
		this.name = name;
		this.WIDTH = document.body.offsetWidth;
		this.HEIGHT = document.body.offsetHeight;
		this.display_rect = { left: 0, top: 0, right: this.WIDTH, bottom: this.HEIGHT };
		this.canvas = null;
		this.ctx = null;

		var c = document.createElement("canvas");
		this.supportsCanvas = c.getContext != null;

		if( !this.supportsCanvas && bAlert )
			alert("Your browser does not support the HTML5 CANVAS tag.");

		if( this.supportsCanvas )
		{
			this.canvas = c;
			this.canvas.id = name;
			this.canvas.name = name;
			this.canvas.setAttribute('width', this.WIDTH);
			this.canvas.setAttribute('height', this.HEIGHT);
			this.canvas.setAttribute('tabIndex', -1);
			document.body.insertBefore(this.canvas, document.body.firstChild);

			this.ctx = this.canvas.getContext("2d");
		}

		this.setSize = function( w, h, bClear )
		{
			this.display_rect.right = this.WIDTH = w;
			this.display_rect.bottom = this.HEIGHT = h;

			if( !this.canvas )
				return;

			this.canvas.width = this.WIDTH;
			this.canvas.height = this.HEIGHT;

			if( bClear )
				this.clear();
		}

		this.setDocumentSize = function( bClear )
		{
			this.setSize( document.body.offsetWidth, document.body.offsetHeight, bClear );
		}

		this.clear = function()
		{
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		}

		this.drawImageFullscreenStretched = function( image )
		{
			this.ctx.drawImage(image, 0, 0, this.canvas.width, this.canvas.height);
		}

		//! @param inflate_scope { x, y } to inflate the repetition scope which is senseful if a rotation effect is applied, too
		this.drawImageFullscreenTiled = function( image, w, h, x, y, inflate_scope )
		{
			var nxmax = this.canvas.width, nymax = this.canvas.height;
			var x0 = -((-(x || 0) + w * 1000) % w);
			var y0 = -((-(y || 0) + h * 1000) % h);

			if (inflate_scope)
			{
				x0 -= Math.floor( (inflate_scope.x + w - 1) / w ) * w;
				y0 -= Math.floor( (inflate_scope.y + h - 1) / h ) * h;
				nxmax += inflate_scope.x;
				nymax += inflate_scope.y;
			}

			for( var ny = y0 ; ny < nymax ; ny += h )
				for( var nx = x0 ; nx < nxmax ; nx += w )
					this.ctx.drawImage(image, nx, ny);
		}

		//! @param inflate_scope { x, y } to inflate the repetition scope which is senseful if a rotation effect is applied, too
		this.drawImageFullscreenTiledCentered = function( image, w, h, x, y, inflate_scope )
		{
			this.drawImageFullscreenTiled(
				image, w, h,
				(x || 0) - w / 2 + this.canvas.width / 2,
				(y || 0) - h / 2 + this.canvas.height / 2,
				inflate_scope
			);
		}
	}



/*
=======================================================

	System Timer API

=======================================================
*/
	kor.SystemTimer = function(
						timer_delay,		//!< delay in millisec. Notice, this value is *ignored* with "animation" useMethod. But if "animation" useMethod is requested and not available, fallback to "interval" will be done where indeed the timer_delay is required again.
						timer_func,			//!< timer function to call periodically as timer_func( SystemTimer ) getting passed the timer object
						useMethod,			//!< "interval" to use setInterval (the default), "timeout" to use setTimeout, "animation" to use requestAnimationFrame.
						canvas				//!< required for "animation" useMethod in webkit case.
					  )
	{
		var that = this;

		this.fnAnimationStartTime =
			window.animationStartTime != null ? function() { return window.animationStartTime; } :
			window.mozAnimationStartTime != null ? function() { return window.mozAnimationStartTime; } :
			window.webkitAnimationStartTime != null ? function() { return window.webkitAnimationStartTime; } :
			window.msAnimationStartTime != null ? function() { return window.msAnimationStartTime; } :
			function() { return (new Date()).getTime(); };
		this.fnRequestAnimationFrame =				// Important: The member must be a function wrapper, not the function itself, at least for mozilla, otherwise we get a javascript error.
			window.requestAnimationFrame != null ? function( callback ) { return window.requestAnimationFrame( callback, canvas ); } :		// here we pass canvas just in case webkit implements the final name of the function
			window.mozRequestAnimationFrame != null ? function( callback ) { return window.mozRequestAnimationFrame( callback ); } :
			window.webkitRequestAnimationFrame != null ? function( callback ) { return window.webkitRequestAnimationFrame( callback, canvas ); } :
			window.msRequestAnimationFrame != null ? function( callback ) { return window.msRequestAnimationFrame( callback ); } :
			null;
		this.fnCancelRequestAnimationFrame =
			window.cancelRequestAnimationFrame != null ? function( handle ) { return window.cancelRequestAnimationFrame( handle ); } :
			window.mozCancelRequestAnimationFrame != null ? function( handle ) { return window.mozCancelRequestAnimationFrame( handle ); } :			// not available for mozilla, but we keep it just in case it would come somewhen.
			window.webkitCancelRequestAnimationFrame != null ? function( handle ) { return window.webkitCancelRequestAnimationFrame( handle ); } :
			window.msCancelRequestAnimationFrame != null ? function( handle ) { return window.msCancelRequestAnimationFrame( handle ); } :
			null;

		if (this.fnRequestAnimationFrame == null && useMethod == "animation")
			useMethod = "interval";					// fallback if "animation" useMethod is not available on the current browser

		this.timer_delay = timer_delay;			// timer delay in millisec
		this.timer_id = null;						// if null, no timer is running or it is paused
		this.useMethod = useMethod || "interval";

		this.fnNow = useMethod == "animation" && this.fnAnimationStartTime != null ?
			this.fnAnimationStartTime :
			function() { return (new Date()).getTime(); };

		this.start_time = this.fnNow();			// when timer has been started. since start of page (excluding any pause durations).
		this.time = 0;								// time since start of page (excluding any pause durations). note: can be a value less than the real current time, because previous pause durations (paused_total) will be subtracted.
		this.tlast = 0;							// previous frame's time (since start of page)
		this.delta_t = 0;							// passed time for the current frame. Milliseconds passed since the previous frame step. (can be exactly 0 for the first frame)
		this.delta_t_stuck = 100;
		this.stuck_detection_time = 250;			// if the browser was stuck for this time at minimum, then we treat it as if delta_t_stuck did just pass.
		this.paused_total = 0;						// paused in total since timer start (start_time)

		this.delegateTick = new kor.Delegate( timer_func );

		this.getTime = function() { return this.time; }

		//! Restart or continue the timer.
		/*!
			@param bContinue
			[optional]
			Set this to false only when a new game is started.
			From level to level, and after pausing, be sure to set this to true
			so that the animation of the player ships do not jump.
			(default = false)

			@return
			Returns the time in milliseconds the game was paused.
			-1 = new start or was already running
		*/
		this.start_timer = function( bContinue )
		{
			if (this.timer_id != null)
				return -1;

			var paused_time = -1;

			if (bContinue)
			{
				paused_time = this.fnNow() - this.paused_total - (this.tlast + this.start_time);
				this.paused_total += paused_time;
			}
			else
			{
				this.start_time = this.fnNow();
				this.time = 0;
				this.tlast = 0;
				this.delta_t = 0;
				this.paused_total = 0;
			}

			if (this.useMethod == "animation")
			{
				this.timer_id = this.fnRequestAnimationFrame( this.anim_proc );
				if (this.timer_id == null)
					this.timer_id = "animation";
			}
			else
			if (this.useMethod == "timeout")
				this.timer_id = setTimeout(this.timer_proc, this.timer_delay);
			else
				this.timer_id = setInterval(this.timer_proc, this.timer_delay);

			return paused_time;
		}

		//! Pause the timer.
		this.stop_timer = function()
		{
			if (this.timer_id != null)
			{
				if (this.useMethod == "animation")
				{
					if (this.fnCancelRequestAnimationFrame)
						this.fnCancelRequestAnimationFrame( this.timer_id );
				}
				else
				if (this.useMethod == "timeout")
					clearTimeout(this.timer_id);
				else
					clearInterval(this.timer_id);

				this.timer_id = null;
			}
		}

		this.timer_running = function()
		{
			return this.timer_id != null;
		}

		this.timer_proc = function()
		{
			if (that.timer_id && that.useMethod == "timeout")
				that.timer_id = setTimeout(that.timer_proc, that.timer_delay);

			that.time = that.fnNow() - that.paused_total - that.start_time;
			that.delta_t = that.time - that.tlast;

			if (that.delta_t >= that.stuck_detection_time)
			{
				var time_skipped = that.delta_t - that.delta_t_stuck;
				that.delta_t = that.delta_t_stuck;
				that.time -= time_skipped;
				that.paused_total += time_skipped;
			}

			that.delegateTick.invoke( that );

			that.tlast = that.time;
		}

		this.anim_proc = function( timestamp )
		{
			if (timestamp == null)		// webkit case
				timestamp = that.fnNow();

			that.time = timestamp - that.paused_total - that.start_time;
			that.delta_t = that.time - that.tlast;

			if (that.delta_t >= that.stuck_detection_time)
			{
				var time_skipped = that.delta_t - that.delta_t_stuck;
				that.delta_t = that.delta_t_stuck;
				that.time -= time_skipped;
				that.paused_total += time_skipped;
			}

			that.delegateTick.invoke( that );

			that.tlast = that.time;

			if (that.timer_id)
				that.fnRequestAnimationFrame( that.anim_proc );
		}
	}



/*
========================================================

	Keyboard API

========================================================
*/

	kor.Keys =
	{
		keyShift		: 16,
		keyCtrl			: 17,
		keyAlt			: 18,
		keyPause		: 19,
		keyCursorLeft	: 37,
		keyCursorUp		: 38,
		keyCursorRight	: 39,
		keyCursorDown	: 40,
		keySpace		: 32,
		key_A			: 65,
		keyPageUp		: 33,
		keyPageDown		: 34,
		keyHome			: 36,
		keyEnd			: 35,
		keyInsert		: 45,
		keyDelete		: 46,
		keyEscape		: 27,
		keyPause		: 19,
		keyReturn		: 13
	}

	//! @remarks Since the Keyboard object will register on the document to get key events, it should be the only one.
	/*!
		@param timer
		a Timer (e.g. kor.SystemTimer) object to retrieve a timestamp from using .getTime() (which is capable of excluding pause durations).
		It need not necessarily be a timer object. It can be any object that has a getTime() method.

		@param bDontRegister
		set to false if you do not want the Keyboard class to register itself for on-key events
	*/
	kor.Keyboard = function( timer, bDontRegister )
	{
		var that = this;

		this.timer = timer;

		/*!
			Map of KeyCodes to human readable names.
			To be used by onkeydown and onkeyup events.
			Each index is a key value.
			Each item is an object { n: "<name>", k: <kind> }.
			k specifies the kind.
				0 = name unknown. n is ignored.
				1 = n contains the name.
				2 = take name from key value as ascii character (fromCharCode). n is ignored.
		*/
		this.key_defs = [
		/*0x00*/	{n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0},
		/*0x08*/	{n:"back", k:1}, {n:"tab", k:1}, {n:null, k:0}, {n:null, k:0}, {n:"center", k:1}, {n:"return", k:1}, {n:null, k:0}, {n:null, k:0},
		/*0x10*/	{n:"shift", k:1}, {n:"ctrl", k:1}, {n:"alt", k:1}, {n:"pause", k:1}, {n:"caps lock", k:1}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0},
		/*0x18*/	{n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:"esc", k:1}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0},
		/*0x20*/	{n:"space", k:1}, {n:"pg up", k:1}, {n:"pg down", k:1}, {n:"end", k:1}, {n:"home", k:1}, {n:"left", k:1}, {n:"up", k:1}, {n:"right", k:1},
		/*0x28*/	{n:"down", k:1}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:"print", k:1}, {n:"ins", k:1}, {n:"del", k:1}, {n:null, k:0},
		/*0x30*/	{n:null, k:2}, {n:null, k:2}, {n:null, k:2}, {n:null, k:2}, {n:null, k:2}, {n:null, k:2}, {n:null, k:2}, {n:null, k:2},
		/*0x38*/	{n:null, k:2}, {n:null, k:2}, {n:null, k:0}, {n:null, k:2}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0},

		/*0x40*/	{n:null, k:0}, {n:null, k:2}, {n:null, k:2}, {n:null, k:2}, {n:null, k:2}, {n:null, k:2}, {n:null, k:2}, {n:null, k:2},
		/*0x48*/	{n:null, k:2}, {n:null, k:2}, {n:null, k:2}, {n:null, k:2}, {n:null, k:2}, {n:null, k:2}, {n:null, k:2}, {n:null, k:2},
		/*0x50*/	{n:null, k:2}, {n:null, k:2}, {n:null, k:2}, {n:null, k:2}, {n:null, k:2}, {n:null, k:2}, {n:null, k:2}, {n:null, k:2},
		/*0x58*/	{n:null, k:2}, {n:null, k:2}, {n:null, k:2}, {n:"windows", k:1}, {n:null, k:2}, {n:"menulist", k:1}, {n:null, k:0}, {n:null, k:0},
		/*0x60*/	{n:"num 0", k:1}, {n:"num 1", k:1}, {n:"num 2", k:1}, {n:"num 3", k:1}, {n:"num 4", k:1}, {n:"num 5", k:1}, {n:"num 6", k:1}, {n:"num 7", k:1},
		/*0x68*/	{n:"num 8", k:1}, {n:"num 9", k:1}, {n:"num *", k:1}, {n:"num +", k:1}, {n:null, k:0}, {n:"num -", k:1}, {n:"num ,", k:1}, {n:"num /", k:1},
		/*0x70*/	{n:"F1", k:1}, {n:"F2", k:1}, {n:"F3", k:1}, {n:"F4", k:1}, {n:"F5", k:1}, {n:"F6", k:1}, {n:"F7", k:1}, {n:"F8", k:1},
		/*0x78*/	{n:"F9", k:1}, {n:"F10", k:1}, {n:"F11", k:1}, {n:"F12", k:1}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0},

		/*0x80*/	{n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0},
		/*0x88*/	{n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0},
		/*0x90*/	{n:"numlock", k:1}, {n:"scroll", k:1}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0},
		/*0x98*/	{n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0},
		/*0xa0*/	{n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:"mute", k:1}, {n:"vol-", k:1}, {n:"vol+", k:1},
		/*0xa8*/	{n:null, k:0}, {n:null, k:0}, {n:"search", k:1}, {n:null, k:0}, {n:"start page", k:1}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0},
		/*0xb0*/	{n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:"play", k:1}, {n:"email", k:1}, {n:null, k:0}, {n:null, k:0}, {n:"calculator", k:1},
		/*0xb8*/	{n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:",", k:1}, {n:null, k:0}, {n:".", k:1}, {n:"/", k:1},

		/*0xc0*/	{n:"`", k:1}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0},
		/*0xc8*/	{n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0},
		/*0xd0*/	{n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0},
		/*0xd8*/	{n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:"ß", k:1}, {n:"^", k:1}, {n:"´", k:1}, {n:"'", k:1}, {n:null, k:0},
		/*0xe0*/	{n:null, k:0}, {n:null, k:0}, {n:"<", k:1}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0},
		/*0xe8*/	{n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0},
		/*0xf0*/	{n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0},
		/*0xf8*/	{n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}, {n:null, k:0}
		];

		this.has_name_for_keycode = function( keyCode )
		{
			return (keyCode >= 0 && keyCode < this.key_defs.length && this.key_defs[ keyCode ].k != 0);
		}

		this.get_name_for_keycode = function( keyCode )
		{
			if (keyCode >= 0 && keyCode < this.key_defs.length)
			{
				var o = this.key_defs[ keyCode ];
				switch (o.k)
				{
					case 1 : return o.n;
					case 2 : return String.fromCharCode( keyCode );
				}
			}

			// In case of o.k being zero, we just display the decimal number prefixed with '#'.
			return "#" + keyCode;
		}

		this.keys_pressed = [];			// which keys are currently pressed and held down. as index, pass the above key* IDs.
		this.keys_down = [];			// which keys currently have a down-key event. as index, pass the above key* IDs.
		this.keys_event_since = [];		// for the keys who are down, the timestamp when they went down respectively.
										// Notice, this timestamp is not a normal time. It is the time of a Timer.
										// Therefore, when the timer is paused, the pause duration is not included in this since-value.

		this.delegateDown = new kor.Delegate;
		this.delegateUp = new kor.Delegate;

		//! Gets the current state of one key.
		/*!
			- pressed		if the key is held down. will be reset automatically by the up event.
							This reflects the current pressed state of the key.

			- down			when the key has been pressed down. It will be set when the key transation goes from non-pressed to pressed state.
							In contrast to pressed event, this flag will *not* be reset automatically.
							You will have to do that manually calling reset_keys().

			- since			the timestamp when the key went down (since start of page, excluding any pause durations)
		*/
		this.get_key = function( keyID )
		{
			return {
				pressed:	this.keys_pressed[keyID],				//!< (bool or null). true = pressed and held down, false/null = not pressed
				down:		this.keys_down[keyID],					//!< (bool or null). true = a down-key event for the current frame. false/null = not
				weight:		1,										//!< a weight factor how strong the key is (actually this is for future input system other than keys with variable strength like moving a joystick or tilting a mobile device, etc.). In principal the weight can be used in conjunction with pressed state.
				since:		(this.keys_event_since[keyID] || 0)	//!< the timestamp when the key went down (since start of page, excluding any pause durations)
			};
		}

		//! resets down state of all keys
		this.reset_keys = function()
		{
			this.keys_down = [];
		}

		// the key event sink
		this.InternalKeyCheck = function( keyID, bDown )
		{
			if( !this.keys_pressed[keyID] && bDown )
			{
				this.keys_down[keyID] = true;
				this.keys_event_since[keyID] = this.timer.getTime();
			}
			this.keys_pressed[keyID] = bDown;
		}

		this.On_Key_Down = function( e )
		{
			var keyID = (window.event) ? event.keyCode : e.keyCode;
			that.InternalKeyCheck( keyID, true );

			that.delegateDown.invoke( {keyID: keyID, keyBoard: that, event: e} );
		}

		this.On_Key_Up = function( e )
		{
			var keyID = (window.event) ? event.keyCode : e.keyCode;
			that.InternalKeyCheck( keyID, false );

			that.delegateUp.invoke( {keyID: keyID, keyBoard: that, event: e} );
		}

		if (!bDontRegister)
		{
			window.onkeydown = this.On_Key_Down;
			window.onkeyup = this.On_Key_Up;
		}
	}
