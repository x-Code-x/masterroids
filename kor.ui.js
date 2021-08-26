/*
kor.ui.js
version 1.0


A library with simple user interface means, aimed on but not limited to
javascript games.


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

kor.system.js
	kor.Keys
	kor.KeyBoard
*/

var kor;
if (!kor) kor = {};



/*
========================================================

	Panel Menu API

	PanelMenu			is a class that allows manipulating a DOM based hierarchy acting
						as a panel-like menu, similar to a dialog.
						It is static, so does not build its buttons dynmically. It takes
						a static DOM tree.
						But it is possible to hide some elements.

						The class deals with UI handling and maneuvering for you.

						A menu button is identified by having an attribute "data-menu-item-id".

						When a button gets the focus or looses it, its class name will be set
						to "menu-item-focused" and "menu-item-unfocused", respectively.

========================================================
*/

	kor.MenuUtils =
	{
		GetMenuItems: function( el, menu_items )
		{
			if( el.firstChild )
				for( var child = el.firstChild ; child ; child = child.nextSibling )
				{
					if( child.getAttribute && child.getAttribute("data-menu-item-id") )
						menu_items.push( child );

					this.GetMenuItems( child, menu_items );
				}
		},

		IsMenuItemVisible: function( el, elRoot )
		{
			if( el.style.display === "none" )
				return false;

			if( el === elRoot || !el.parentNode )
				return true;

			return this.IsMenuItemVisible( el.parentNode, elRoot );
		}
	}

	kor.PanelMenu = function( elMenuBase, keyBoard )
	{
		var that = this;

		this.elMenu = elMenuBase;
		this.id = this.elMenu.getAttribute("id");
		this.menu_items = [];
		this.menu_items_by_menu_id = {};
		kor.MenuUtils.GetMenuItems( this.elMenu, this.menu_items );
		this.focused_menu_item_index = -1;
		this.keyBoard = keyBoard;

		this.delegateClicked = new kor.Delegate;	//!< add a delegate to this to get informed when any menu item has been clicked (or return pressed)
		this.delegatesClicked = [];					//!< map of menu item id to delegate, invoked when the according menu item has been clicked (or return pressed)

		for( var i in this.menu_items )
			this.menu_items_by_menu_id[this.menu_items[i].getAttribute("data-menu-item-id")] = this.menu_items[i];

		this.focus_menu_item = function( index )
		{
			if( this.focused_menu_item_index === index )
				return;

			if( this.focused_menu_item_index >= 0 )
				this.menu_items[this.focused_menu_item_index].className = "menu-item-unfocused";

			if( index >= this.menu_items.length )
				index = -1;

			this.focused_menu_item_index = index;

			if( index >= 0 )
				this.menu_items[index].className = "menu-item-focused";
		}

		this.onkey = function( e )
		{
			if( that.is_visible() )
				switch( e.keyID )
				{
					case kor.Keys.keyCursorDown :
						that.next();
						break;
					case kor.Keys.keyCursorUp :
						that.prev();
						break;
					case kor.Keys.keyReturn :
						that.onclick( that.focused_menu_item_index );
						break;
				}
		}

		this.next = function()
		{
			if( this.menu_items.length > 0 &&
				this.is_visible() )
			{
				do {
					this.focus_menu_item( (this.focused_menu_item_index + 1) % this.menu_items.length );
				} while( !kor.MenuUtils.IsMenuItemVisible( this.menu_items[this.focused_menu_item_index], this.elMenu ) );
			}
		}

		this.prev = function()
		{
			if( this.menu_items.length > 0 &&
				this.is_visible() )
			{
				if( this.focused_menu_item_index < 0 )
					this.focused_menu_item_index = 0;
				do {
					this.focus_menu_item( (this.focused_menu_item_index + this.menu_items.length - 1) % this.menu_items.length );
				} while( !kor.MenuUtils.IsMenuItemVisible( this.menu_items[this.focused_menu_item_index], this.elMenu ) );
			}
		}

		this.onhover = function( index )
		{
			that.focus_menu_item( index );
		}

		this.onclick = function( index )
		{
			if( index >= 0 &&
				index < that.menu_items.length &&
				that.is_visible() )
			{
				var e =
				{
					index:		index,
					id:			that.menu_items[index].getAttribute("data-menu-item-id"),
					elItem:		that.menu_items[index],
					menu:		that
				};

				that.delegateClicked.invoke( e );
				kor.Delegate.invoke( that.delegatesClicked[e.id], e );
			}
		}

		this.keyBoard.delegateDown.add( this.onkey );

		for( var i in this.menu_items )
		{
			// prepare each menu item
			var item = this.menu_items[i];
			var id = item.getAttribute("data-menu-item-id");

			item.panelMenu = this;
			item.setAttribute( "onmouseover", "this.panelMenu.onhover(" + i + ")" );
			item.setAttribute( "onmouseout", "this.panelMenu.onhover(-1)" );
			item.setAttribute( "onclick", "this.panelMenu.onclick(" + i + ")" );

			this.delegatesClicked[id] = new kor.Delegate;
		}

		this.is_visible = function() { return this.elMenu.style.display !== "none"; }

		//! shows or hides the menu
		/*!
			When showing, also the focus will be set to the first visible menu item.

			Because of that, you should do all your desired showSection() calls first so
			that show() can find out, which menu items are visible and which not.
		*/
		this.show = function( bShow )
		{
			this.elMenu.style.display = bShow ? "block" : "none";
			this.focus_menu_item( -1 );
			this.next();
		}

		this.showSection = function( element_id, bShow )
		{
			var el = document.getElementById( element_id );
			if( el )
				el.style.display = bShow ? "block" : "none";
		}
	}
