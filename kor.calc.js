/*
kor.calc.js
version 1.0


A library with classes related to math and calculation.


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

none
*/

var kor;
if (!kor) kor = {};



/*
========================================================

	Vector calculation API

========================================================
*/

	kor.Scalar =
	{
		interpolate: function( n0, n1, s )
		{
			return (n1 - n0) * s + n0;
		}
	}

	kor.Vec =
	{
		halfPI: 0.5 * Math.PI,
		twoPI: 2 * Math.PI,
		huge_2PI: 1000 * 2 * Math.PI,
		rezip_2PI: 0.5 / Math.PI,
		degreeToRadian: Math.PI / 180,

		add: function( vec1, vec2 )
		{
			return {
				x: vec1.x + vec2.x,
				y: vec1.y + vec2.y
			};
		},

		//! vec1 minus vec2
		sub: function( vec1, vec2 )
		{
			return {
				x: vec1.x - vec2.x,
				y: vec1.y - vec2.y
			};
		},

		length: function( vec )
		{
			return Math.sqrt( vec.x * vec.x + vec.y * vec.y );
		},

		length_sqr: function( vec )
		{
			return vec.x * vec.x + vec.y * vec.y;
		},

		scale: function( vec, s )
		{
			return {
				x: vec.x * s,
				y: vec.y * s
			};
		},

		interpolate: function( vec1, vec2, s )
		{
			return {
				x: kor.Scalar.interpolate( vec1.x, vec2.x, s ),
				y: kor.Scalar.interpolate( vec1.y, vec2.y, s )
			};
		},

		//! inverse scaling
		divide: function( vec, rezip_s )
		{
			return {
				x: vec.x / rezip_s,
				y: vec.y / rezip_s
			};
		},

		floor: function( vec )
		{
			return {
				x: Math.floor( vec.x ),
				y: Math.floor( vec.y )
			};
		},

		distance_sqr: function( vec1, vec2 )
		{
			var dx = vec1.x - vec2.x;
			var dy = vec1.y - vec2.y;
			return dx * dx + dy * dy;
		},

		normalize: function( vec )
		{
			var len = this.length( vec );
			var s = len === 0 ? 0 : 1 / len;
			return {
				x: vec.x * s,
				y: vec.y * s
			};
		},

		/*!
			@param orientation
			is the orientation angle (radian).
			0 = {x:0, y:-1} so up vector.
			PI/2 = {x:-1, y:0} so left vector.
			increasing values rotate counter clockwise (when x axis points right and y axis points down).
		*/
		from_orientation: function( orientation, s )
		{
			return {
				x: -Math.sin( orientation ) * s,
				y: -Math.cos( orientation ) * s
			};
		},

		to_orientation: function( vec )
		{
			var r = Math.atan2( -vec.x, -vec.y );
			if( r < 0 ) r += this.twoPI;
			return r;
		},

		//! Returns angle between 0 and PI. Undirected because it makes no difference here when v1 and v2 are exchanged.
		undirected_angle: function( v1, v2 )
		{
			v1 = this.normalize( v1 );
			v2 = this.normalize( v2 );
			return Math.acos( v1.x * v2.x + v1.y * v2.y );
		},

		keep_in_rect: function( vec, rect )
		{
			var ret = { x: vec.x, y: vec.y };
			if( vec.x < rect.left || vec.x >= rect.right )
				if( rect.right > rect.left )    // if the rect has size 0, skip
				{
					var cx = rect.right - rect.left;
					ret.x = ((vec.x - rect.left) + 1000 * cx) % cx + rect.left;
				}
			if( vec.y < rect.top || vec.y >= rect.bottom )
				if( rect.bottom > rect.top )    // if the rect has size 0, skip
				{
					var cy = rect.bottom - rect.top;
					ret.y = ((vec.y - rect.top) + 1000 * cy) % cy + rect.top;
				}
			return ret;
		},

		is_in_rect: function( vec, rect )
		{
			return vec.x >= rect.left && vec.x < rect.right &&
					vec.y >= rect.top  && vec.y < rect.bottom;
		},

		//! Calculates a position on one of the borders of the passed rect.
		/*!
			@param s
			[0 - 1]
			Indicates where to create the position.
			0 = top left
			1 = top left
			0.5 = bottom right
			going in counter-clockwise direction.
		*/
		rect_border_pos: function( rect, s )
		{
			var cx = rect.right - rect.left;
			var cy = rect.bottom - rect.top;
			var n = (2 * cx + 2 * cy) * s;
			if( n <= cx ) return { x: n + rect.left, y: rect.top };
			if( (n -= cx) <= cy ) return { x: rect.right, y: n + rect.top };
			if( (n -= cy) <= cx ) return { x: rect.right - n, y: rect.bottom };
			n -= cx; return { x: rect.left, y: rect.bottom - n };
		},

		//! Calculates an orientation range for a position on one of the borders of the passed rect.
		/*!
			The orientation will be towards inside the rect.

			@param s
			[0 - 1]
			Indicates where to put the reference position.
			0 = top left
			1 = top left
			0.5 = bottom right
			going in counter-clockwise direction.

			@return
			A { pos, O_from, O_to, pick_orientation(s) } object.
		*/
		rect_border_pos_orientation_range: function( rect, s )
		{
			var cx = rect.right - rect.left;
			var cy = rect.bottom - rect.top;
			if( cx < 1 ) cx = 1;
			if( cy < 1 ) cy = 1;
			var n = (2 * cx + 2 * cy) * s;

			var d;
			if( n <= cx )
				d = {
					pos: { x: n + rect.left, y: rect.top },
					v1: { x: rect.left,  y: rect.top + cy * 0.1 },
					v2: { x: rect.right, y: rect.top + cy * 0.1 }
				};
			else
			if( (n -= cx) <= cy )
				d = {
					pos: { x: rect.right, y: n + rect.top },
					v1: { x: rect.right - cx * 0.1, y: rect.top },
					v2: { x: rect.right - cx * 0.1, y: rect.bottom }
				};
			else
			if( (n -= cy) <= cx )
				d = {
					pos: { x: rect.right - n, y: rect.bottom },
					v1: { x: rect.right, y: rect.bottom - cy * 0.1 },
					v2: { x: rect.left,  y: rect.bottom - cy * 0.1 }
				};
			else
			{
				n -= cx;
				d = {
					pos: { x: rect.left, y: rect.bottom - n },
					v1: { x: rect.left + cx * 0.1, y: rect.bottom },
					v2: { x: rect.left + cx * 0.1, y: rect.top }
				};
			}

			d.O_from = this.to_orientation({ x: d.v1.x - d.pos.x, y: d.v1.y - d.pos.y });
			d.O_to   = this.to_orientation({ x: d.v2.x - d.pos.x, y: d.v2.y - d.pos.y });
			if( d.O_to < d.O_from )
				d.O_to += this.twoPI;

			d.pick_orientation = function( s )
			{
				var o = (this.O_to - this.O_from) * s + this.O_from;
				return (o + kor.Vec.huge_2PI) % kor.Vec.twoPI;
			}

			return d;
		},

		rect_any_pos: function( rect, sx, sy )
		{
			var cx = rect.right - rect.left;
			var cy = rect.bottom - rect.top;
			return { x: rect.left + sx * cx, y: rect.top + sy * cy };
		},

		from_size: function( size_or_x, y )
		{
			return y != null ?
				{ x: size_or_x, y: y } : size_or_x.offsetWidth != null ?
				{ x: size_or_x.offsetWidth, y: size_or_x.offsetHeight } :
				{ x: size_or_x.width || size_or_x.x, y: size_or_x.height || size_or_x.y };
		},

		set_width_height: function( vec, obj )
		{
			obj.width = vec.x + "px";
			obj.height = vec.y + "px";
		},

		set_left_top: function( vec, obj )
		{
			obj.left = vec.x + "px";
			obj.top = vec.y + "px";
		}
	}



/*
========================================================

	Rect calculation API

========================================================
*/

	kor.Rect =
	{
		width:	function( rect ) { return rect.right - rect.left; },
		height:	function( rect ) { return rect.bottom - rect.top; },

		xcenter: function( rect ) { return (rect.right + rect.left) / 2; },
		ycenter: function( rect ) { return (rect.bottom + rect.top) / 2; },

		offset: function( rect, dx, dy )
		{
			return { left: rect.left + dx, top: rect.top + dy, right: rect.right + dx, bottom: rect.bottom + dy };
		},

		inflate: function( rect, dx, dy )
		{
			if( dy == null ) dy = dx;
			return { left: rect.left - dx, top: rect.top - dy, right: rect.right + dx, bottom: rect.bottom + dy };
		},

		deflate: function( rect, dx, dy )
		{
			if( dy == null ) dy = dx;
			return { left: rect.left + dx, top: rect.top + dy, right: rect.right - dx, bottom: rect.bottom - dy };
		},

		union: function( r1, r2 )
		{
			return {
				left: Math.min( r1.left, r2.left ),
				top: Math.min( r1.top, r2.top ),
				right: Math.max( r1.right, r2.right ),
				bottom: Math.max( r1.bottom, r2.bottom )
			};
		},

		intersect: function( r1, r2 )
		{
			return {
				left: Math.max( r1.left, r2.left ),
				top: Math.max( r1.top, r2.top ),
				right: Math.min( r1.right, r2.right ),
				bottom: Math.min( r1.bottom, r2.bottom )
			};
		},

		empty: function( rect )
		{
			return rect.right <= rect.left || rect.bottom <= rect.top;
		},

		size: function( rect )
		{
			return { x: rect.right - rect.left, y: rect.bottom - rect.top };
		},

		from_size: function( size_or_x, y )
		{
			return y != null ?
				{ left: 0, top: 0, right: size_or_x, bottom: y } : size_or_x.offsetWidth ?
				{ left: 0, top: 0, right: size_or_x.offsetWidth, bottom: size_or_x.offsetHeight } :
				{ left: 0, top: 0, right: size_or_x.width || size_or_x.x, bottom: size_or_x.height || size_or_x.y };
		},

		set_width_height: function( rect, obj )
		{
			kor.Vec.set_width_height( this.size( rect ), obj );
		},

		set_left_top: function( rect, obj )
		{
			obj.left = rect.left + "px";
			obj.top = rect.top + "px";
		},

		dock_left: function( rect, x )
		{
			var w = rect.right - rect.left;
			return {
				left:	x,
				right:	x + w,
				top:	rect.top,
				bottom:	rect.bottom
			};
		},

		dock_right: function( rect, x )
		{
			var w = rect.right - rect.left;
			return {
				left:	x - w,
				right:	x,
				top:	rect.top,
				bottom:	rect.bottom
			};
		},

		dock_xcenter: function( rect, x )
		{
			var w = rect.right - rect.left;
			return {
				left:	x - w / 2,
				right:	x + w / 2,
				top:	rect.top,
				bottom:	rect.bottom
			};
		},

		dock_top: function( rect, y )
		{
			var h = rect.bottom - rect.top;
			return {
				left:	rect.left,
				right:	rect.right,
				top:	y,
				bottom:	y + h
			};
		},

		dock_bottom: function( rect, y )
		{
			var h = rect.bottom - rect.top;
			return {
				left:	rect.left,
				right:	rect.right,
				top:	y - h,
				bottom:	y
			};
		},

		dock_ycenter: function( rect, y )
		{
			var h = rect.bottom - rect.top;
			return {
				left:	rect.left,
				right:	rect.right,
				top:	y - h / 2,
				bottom:	y + h / 2
			};
		},

		floor: function( rect )
		{
			return {
				left:	Math.floor( rect.left ),
				top:	Math.floor( rect.top ),
				right:	Math.floor( rect.right ),
				bottom:	Math.floor( rect.bottom )
			};
		}
	}
