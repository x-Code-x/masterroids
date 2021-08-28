/*
kor.core.js
version 1.0


A library with some basic useful utilities and classes.


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

	Delegate util		can store multiple functions
						and invoke them at once

========================================================
*/

	kor.Delegate = function( fn1 )
	{
		this.functions = [];

		this.add = function( fn )
		{
			if( fn == null )
				return;

			for( var i = 0, l = this.functions.length ; i < l ; ++i )
				if( this.functions[i] === fn )
					return;

			this.functions.push( fn );
		}

		this.remove = function( fn )
		{
			if( fn == null )
				return;

			for( var i = 0, l = this.functions.length ; i < l ; ++i )
				if( this.functions[i] === fn )
				{
					this.functions.splice( i, 1 );
					return;
				}
		}

		this.invoke = function( e )
		{
			for( var i = 0, l = this.functions.length ; i < l ; ++i )
				this.functions[i]( e );
		}

		if( fn1 )
			this.add( fn1 );
	}

	// static functions which also check for the delegate being null

	kor.Delegate.add = function( delegate, fn )
	{
		if( delegate )
			delegate.add( fn );
	}

	kor.Delegate.remove = function( delegate, fn )
	{
		if( delegate )
			delegate.remove( fn );
	}

	kor.Delegate.invoke = function( delegate, e )
	{
		if( delegate )
			delegate.invoke( e );
	}



/*
========================================================

	Array helper API

========================================================
*/

	kor.Array =
	{
		resize: function( arr, newSize, defaultValue )
		{
			while ( newSize > arr.length )
				arr.push( defaultValue );
			arr.length = newSize;
		}
	}



/*
========================================================

	Path helper API

========================================================
*/

	kor.Path =
	{
		isUrlAbsolute: function( url )
		{
			return url.match(/^[^\/]+:.*|^\/.*/) != null;
		},

		getExtension: function( src )
		{
			return (/\.([^.:\/\\]+)$/).exec(src)[1];
		}
	}



/*
==========================================

	index & id pool

	These kinds of pools have each different requirements.

	An index pool returns indices used for arrays. It ensures that index values are as low as possible.
	This is done by immediately returning a released index once a new one is queried.

	An id pool ensures to reuse released ids as late as possible.
	That can be necessary e.g. for ids of entities used over network communication.
	Communication delays can cause short inconsistencies of existing and released
	ids on different machines when trying to keep them concurrent.
	To prevent conflicts, a machine should not release an id and again
	get the same one again on the next immediately following query because another machine
	might not have enough time to get informed that the id now belongs to another entity.

	The provided pool mainly is an index pool.
	But its internal implementation will return the oldest released index when querying anotherone.
	That is, returned indices are held in a queue rather than a stack.
	This enables being used as id pool when ensuring to initially reserve many dummy indices
	(just as fakes, non existing entities).
	The sense is just to keep the gap long between releasing and reviving of an index value.
	To make it long enough, you have to make sure to pass an appropriate value for initially_released.
	A good value might be an equivalent for several seconds. E.g. if you have at most frequent phases
	let's say 100 indices to retrieve and release within one second, a good value could be to set
	it to 500 (the equivalent for 5 seconds in this sample) so that the time gap between releasing
	and reviving an index value does not go under 5 seconds approximately.

==========================================
*/

	//! Returns and reserves indices.
	/*!
		When releasing an index, it can be reused later on.

		This makes sense when your number of indices is growing and shrinking repeatedly over time
		but you want to use them as indices into an array. Reusing those indices will prevent
		too many items being created in the array which later on would never be used again
		if the dismissed indices could not be reused.
	*/
	kor.index_pool = function( initially_released )
	{
		this.returned = [];			// stack of indices not in use any more
		this.running_index = 0;		// index value used for new index

		if( initially_released )
		{
			while( this.running_index < initially_released )
				this.returned.push( this.running_index++ );
		}

		//! Retrieves and reserves an index.
		this.query_index = function()
		{
			return this.returned.length > 0 ?
				this.returned.splice( 0, 1 )[0] :	// We take an index from the returned array if available. But we splice the first (so oldest) one away, and so treating the array as a queue, instead of using pop() which would treat it as a stack.
				this.running_index++;
		}

		//! Releases the passed index, so returns it to the returned stack.
		this.release_index = function( index )
		{
			// We return the index to the returned stack.
			this.returned.push( index );
		}
	}



/*
==========================================

	ordered_dictionary

==========================================
*/

	/*!
		An own dictionary object that keeps order of values.

		It is capable of adding items, removing items, iterating, accessing by key.
		And it keeps item counts in internal arrays low for faster iterating.

		Because of the need to keep the order, it is not very fast.

		To keep the order, the values must have a property "priority" which
		must be capable of being subtracted from another priority value.
		The sort order is, that higher priority values come first in the ordered array.

		this.ordered can be used to iterate over sorted pairs.
	*/
	kor.ordered_dictionary = function()
	{
		this.pairs = [];		// map of keys to pairs { key: key, value: object }
		this.ordered = [];		// indexed, consecutive array of pairs { key: key, value: object }

		this.add = function( key, val )
		{
			var pair = { key: key, value: val };
			if( this.pairs[key] != null )
			{
				var i = this.find_index( key );
				this.ordered[i] = pair;
			}
			else
				this.ordered.push( pair );
			this.pairs[key] = pair;
			this.sort();
		}

		this.erase = function( key )
		{
			if( this.pairs[key] != null )
			{
				this.pairs[key] = null;
				var i = this.find_index( key );
				this.ordered.splice( i, 1 );
			}
		}

		//! Sorts values by their .priority property. Higher values come first.
		this.sort = function()
		{
			this.ordered.sort( this.compare );
		}

		// private
		this.compare = function( p1, p2 )
		{
			return (p2 ? p2.value.priority : -1000000) - (p1 ? p1.value.priority : -1000000);
		}

		this.find_index = function( key )
		{
			var count = this.ordered.length;
			for( var i = 0 ; i < count ; ++i )
				if( this.ordered[i].key === key )
					return i;
			return -1;
		}
	}
