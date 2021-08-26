/*
kor.game.js
version 1.0


A library with utilities and classes useful for javascript games.


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
kor.calc.js
kor.media.js
kor.system.js
kor.sprite.js
*/

var kor;
if (!kor) kor = {};



/*
========================================================================================================

	SceneryPainter

	SceneryPainter.sprite_collection		The sprite collection to paint.
											You have to initialize and update it manually.

	Effect parameters (to be adjusted manually):
	SceneryPainter.background_offset		The background will be painted offsetted by this vector.
	SceneryPainter.sprites_offset			All painted sprites will be offsetted by this vector,
											additional to their position vector.
	SceneryPainter.rotation_angle			The whole scenery (background and sprites) will be drawn
											rotated by this angle, rotated around the following center
											definitions.
	SceneryPainter.background_angle_center	Center of rotation for rotating the background image.
	SceneryPainter.sprites_angle_center		Center of rotation for rotating all the painted sprites.

========================================================================================================
*/

	/*!
		@param surface			a surface to render into, as in kor.system.js
		@param backgroundImage	a background image media, as in kor.media.js, retrieved through kor.ImageLoader
	*/
	kor.SceneryPainter = function( surface, backgroundImage )
	{
		var that = this;

		this.surface = surface;
		this.backgroundImage = backgroundImage;

		//! The sprite collection to paint.
		//! You have to initialize and update it manually.
		this.sprite_collection = null;

		//! Values used for shockwave shake effect.
		//! Adjust them manually before drawing.
		this.background_offset       = { x: 0, y: 0 };
		this.sprites_offset          = { x: 0, y: 0 };
		this.rotation_angle          = 0;
		this.background_angle_center = { x: 0, y: 0 };
		this.sprites_angle_center    = { x: 0, y: 0 };

		this.draw = function()
		{
			this.surface.clear();

			if( this.backgroundImage.getCanvas() )
			{
				this.surface.ctx.save();

				var inflate = null;
				if (this.rotation_angle)
				{
					this.surface.ctx.translate( this.background_angle_center.x, this.background_angle_center.y );
					this.surface.ctx.rotate( this.rotation_angle );
					this.surface.ctx.translate( -this.background_angle_center.x, -this.background_angle_center.y );

					inflate = Math.max( this.surface.WIDTH, this.surface.HEIGHT );
					inflate = { x: inflate, y: inflate };
				}

				this.surface.drawImageFullscreenTiledCentered(
					this.backgroundImage.getCanvas(),
					this.backgroundImage.width, this.backgroundImage.height,
					this.background_offset.x, this.background_offset.y,
					inflate
				);

				this.surface.ctx.restore();
			}

			if( this.sprite_collection )
			{
				this.surface.ctx.save();

				if (this.rotation_angle)
				{
					this.surface.ctx.translate( this.sprites_angle_center.x, this.sprites_angle_center.y );
					this.surface.ctx.rotate( this.rotation_angle );
					this.surface.ctx.translate( -this.sprites_angle_center.x, -this.sprites_angle_center.y );
				}

				this.surface.ctx.translate( this.sprites_offset.x, this.sprites_offset.y );

				this.sprite_collection.foreach( function( sprite )
				{
					sprite.draw( that.surface.ctx );
				});

				this.surface.ctx.restore();
			}
		}
	}



/*
=====================================================

	flying_object
	and related

	A flying_object is an object acting in the game.
	It has different modes where one is active and
	with each mode, a sprite is associated.

=====================================================
*/

	kor.FlyingObjectModes =
	{
		off: 0,
		explosion: 1,
		next_value: 2		// to add new values to this enum, begin with next_value. This is necessary because mode values should be consecutive because they are used as array indices.
	}

	/*!
		@param select_sprite_on_orientation
		true:
			if the sprite is of kind kor.sprite_one_of_many, then the absolute_orientation of the flying_object defines which sprite is selected.
			if the sprite is of kind kor.sprite, so just a single image, this param being true makes sense only if the use_rotation is set for the sprite.
		false / null:
			the flying_object does not automatically select a sprite. So you can select in an actuator_fct yourself.
	*/
	kor.flying_object_mode = function(
								sprite_factory,		//!< a kor.SpriteFactory, or a function that returns a kor.SpriteFactory
								actuator_fct,
								select_sprite_on_orientation,
								sound_activate,
								sound_deactivate,
								invulnerable		//!< Set this to true if you want to forbid a flying_object in this mode of being exploded.
							  )
	{
		this.sprite_factory = sprite_factory;
		this.actuator_fct = actuator_fct;
		this.select_sprite_on_orientation = select_sprite_on_orientation ? true : false;
		this.sound_activate = sound_activate;
		this.sound_deactivate = sound_deactivate;
		this.invulnerable = (invulnerable || false);
	}

	// states of the relative_to object
	kor.RelativeTo_States =
	{
		Null: 0,	//!< no special state to take care of
		Died: 1		//!< the relative_to object died (e.g. player ship exploded, so that guards/protectors or other child flying_object's have to die too)
	}

	/*!
		A flying_object contains one sprite that can be switched.
		It has a position and an orientation.
		It (more axactly, its coordinate system) can be relative to the universe or to another flying_object.

		@param foGlobals
		params global to all flying_object's, especially the collection a flying_object belongs to.
		It should be {flying_objects, flying_objects_count, collidable_objects, sprite_collection, sounds_on, getTime()}.

		@param bCollidable
		Indicates if the object shall check collisions with other objects. Usually this is done for
		objects which can cause other objects to explode (like shots, guards etc.), because these
		objects are usually less in number that can cause others to explode compared to the number
		of explodable objects.
	*/
	kor.flying_object = function(		// a kor.flying_object may have no sprite
							foGlobals,
							object_kind,
							bCollidable
						 )
	{
		this.foGlobals = foGlobals;		// the collection of flying objects this one belongs to. usually a GameSession has those.
		this.object_kind = object_kind;
		this.Index = foGlobals.index_pool.query_index();
		this.creation_time = foGlobals.getTime();

		this.foGlobals.flying_objects[this.Index] = this;
		++this.foGlobals.flying_objects_count;

		if( bCollidable )
			this.foGlobals.collidable_objects[this.Index] = this;
		this.collidable = (bCollidable || false);
		this.skip_collisions = false;// if true, this object is skipped when checking for collisions (used e.g. when ship is warping). (if true, it usually also means to skip this object for other's near_objects detection)
		// Note: this.skip_collisions is different to this.invulnerable(). See remarks to this.invulnerable() for more on this.

		this.popped_up_from_explosion = false;	// indicates if this flying_object appeared (popped up) out from the explosion of another flying_object (like child comets, extras or dangers popping up from the explosion of a bigger comet). used by shockwave object to know if to skip those.

		this.relative_to = null;	// the flying_object this flying_object is relative to. null means relative to the universe.
		this.children = null;		// all the flying_object's which are directly relative to this flying_object. must be null or a ordered_dictionary object.
		this.priority = 0;			// this is used by children's sort function (ordered_dictionary) to sort children by their priority. higher values come first.
		this.relative_to_state_change = kor.RelativeTo_States.Null;	// what happened to the relative_to object. used to react on the event in the actuator_fct.

		this.pos = { x: 0, y: 0 };
		this.orientation = 0;       				// where the object looks. range 0 - 2*PI. 0 looks up (forward) and higher values rotate counter-clockwise (RHS).
		this.apply_parent_orientation = true;		// if this child object shall use (true) or ignore (false) the parent flying_object's absolute_orientation.
		this.scale = 1;

		this.absolute_pos = { x: 0, y: 0 };
		this.absolute_orientation = 0;

		this.modes = [];							// set of kor.flying_object_mode's (indexed by kor.FlyingObjectModes)
		this.active_mode = kor.FlyingObjectModes.off;	// which mode (and sprite factory) is currently active. kor.FlyingObjectModes.off = none
		this.active_mode_object = null;
		this.active_sprite = null;					// and the currently active sprite itself. null = none, means the flying_object is disabled
		this.active_collision_radius = 0;
		this.active_spritekind = null;

		this.collisions = [];
		this.near_objects = null;		// if a non-null array, this flying_object desires a list of objects which are nearest to itself. Each item is an object { distance_sqr: ?, FO: ? }. The array may *not* contain null elements, *nor* may any item's FO object be null. The nearest object is at the end of the array.
		this.near_distance_sqr = null;	// function returning outer distance, squared, at which to start checking for near objects.
		this.want_more_near_objects = null;		// set this to an array of sprite_kinds that you want to have in the near_objects list even if they are marked as non-collidable (so usually would not be included in collision and near object detection). Set in here only those sprite_kinds which are not included into near_objects automatically anyway.

		this.active_actuator_fct = null;	// the function to call for moving/actuating the flying_object.
		this.player_inputs = null;			// will be used by the active_actuator_fct if it needs inputs/keys. The caller has to set the right one here by himself.

		// preparing values for act_player_ship:
		this.a_v_velocity = { x: 0, y: 0 };		// in pixels per millisecond
		// values for act_shot:
		this.a_origin_object = null;				// non null if this flying_object has been invoked by another flying_object. (e.g. a shot). so to prevent this flying_object form hitting and destroying its origin_object. and for increasing the origin's score.

		this.score_on_destroy = 0;		// the value of this flying_object that increases the player's score when he destroys it.
		this.score_on_avoided = 0;
		this.exploded_by = null;		// the flying_object that caused This one to start exploding. can be used as indicator that the object is dead (exploding/exploded), but *only* if the objet can be exploded at all.
		this.released = false;

		//! Call this when you no longer need this flying object. (end of lifetime, even of the javascript object.)
		/*!
			@remarks
			Remember: In the same frame step, another flying_object's actuator may be accessing this
			flying_object even *after* it has been released. That can happen when the other flying_object
			has this one in its collision list and is executed after this one.
			For the same reason it can even happen that a flying_object is released twice or more (one after each other)
			which is taken care of by this method automatically, so it is not harmful to call release() on an object more than once.
		*/
		this.release = function()
		{
			if( this.released ) return;
			this.released = true;

			if( this.on_releasing )
				this.on_releasing();

			this.disable();

			this.foGlobals.flying_objects[this.Index] = null;

			//if( this.foGlobals.collidable_objects[this.Index] )
			if( this.collidable )
				this.foGlobals.collidable_objects[this.Index] = null;

			this.make_relative_to( null );

			if( this.children )
				while( this.children.ordered.length )
				{
					var child = this.children.ordered[0];
					child.value.detach();     // detach() also lets the child remain on its absolute position. The relative position is recalculated. We need not to recalc anything else.
				}

			this.children = null;

			this.collisions = null;
			this.near_objects = null;

			--this.foGlobals.flying_objects_count;

			this.foGlobals.index_pool.release_index( this.Index );
		}

		this.on_releasing = null;   // a function called when this flying_object is being released

		this.release_children = function()
		{
			if( this.children )
			{
				while( this.children.ordered.length )
				{
					var child = this.children.ordered[0];
					child.value.release();
				}

				this.children = new kor.ordered_dictionary();
			}
		}

		/*!
			Sets (adds) a mode to the internal set of modes, or removes one.

			@param mode
			a kor.FlyingObjectModes value

			@param mode_object
			a kor.flying_object_mode object with the sprite factory to use for this mode.
		*/
		this.set_sprite = function( mode, mode_object )
		{
			this.modes[mode] = mode_object;

			// Let's check if we changed the active sprite.
			if( this.active_sprite && this.active_mode === mode )
			{
				this.foGlobals.sprite_collection.remove( this.active_sprite );

				// We get the new sprite from its factory
				if( mode_object.sprite_factory )
				{
					this.active_sprite = mode_object.sprite_factory.create ? mode_object.sprite_factory.create() : mode_object.sprite_factory().create();
					this.foGlobals.sprite_collection.add( this.active_sprite );

					this.active_mode = mode;
					this.active_mode_object = mode_object;
					this.active_collision_radius = this.active_sprite.collision_radius;
					this.active_spritekind = this.active_sprite.spritekind;
					this.active_actuator_fct = mode_object.actuator_fct;
				}
				else
				{
					this.active_sprite = null;
					this.active_mode = kor.FlyingObjectModes.off;
					this.active_mode_object = null;
					this.active_collision_radius = 0;
					this.active_spritekind = null;
					this.active_actuator_fct = null;
				}
			}
		}

		/*!
			Sets one of the available sprites as the active one.

			@param mode
			a kor.FlyingObjectModes value
			Here, .off is not allowed. For this, use this.disable() instead.

			@param bPlay_sound
			If the mode has a sound defined, too, then this sound will be played
			only if you pass true to this param.

			@return
			true if a new mode has been activated successfully or if it was active already.

			@remarks
			It is very important to return true when the desired mode is active already.
			This is important for when an object is being exploded by collision.
			In case, both colliding objects detect their collisions, both should be
			able to call xplode() and get true returned so that they can do additional
			stuff like increasing score.
			But if set_active_sprite() would return false in case the mode was active already,
			the 2nd collided object would call explode(), too, like the first one (on both objects),
			so the 2nd one would receive false and could not perform its required operations.
		*/
		this.set_active_sprite = function( mode, bPlay_sound )
		{
			if( this.active_mode === mode )
				return true;

			var mode_object = this.modes[mode];
			if( !mode_object )     // illegal mode specified
				return false;

			if( bPlay_sound && this.foGlobals.sounds_on )
			{
				if( mode_object.sound_activate )
				{
					if( mode_object.sound_deactivate ) mode_object.sound_deactivate.stop();
					mode_object.sound_activate.play();
				}
				else
				if( this.active_mode_object && this.active_mode_object.sound_deactivate )
				{
					if( this.active_mode_object.sound_activate ) this.active_mode_object.sound_activate.stop();
					this.active_mode_object.sound_deactivate.play();
				}
			}

			if( mode_object.sprite_factory == null )
				{ this.disable(); return true; }

			if( this.active_sprite )
				this.foGlobals.sprite_collection.remove( this.active_sprite );

			this.active_sprite = mode_object.sprite_factory.create ? mode_object.sprite_factory.create() : mode_object.sprite_factory().create();
			this.foGlobals.sprite_collection.add( this.active_sprite );

			this.active_mode = mode;
			this.active_mode_object = mode_object;

			this.active_sprite.set_pos( this.absolute_pos.x, this.absolute_pos.y, this.scale );
			this.active_sprite.show( true );
			this.active_collision_radius = this.active_sprite.collision_radius;
			this.active_spritekind = this.active_sprite.spritekind;

			this.active_actuator_fct = mode_object.actuator_fct;
			return true;
		}

		//! Should be called if a new sprite factory has been set for the flying_object.
		this.update_active_sprite = function()
		{
			if (this.active_sprite && this.active_mode_object)
			{
				var bWasVisible = this.active_sprite.is_visible();
				this.foGlobals.sprite_collection.remove( this.active_sprite );

				this.active_sprite = this.active_mode_object.sprite_factory.create ? this.active_mode_object.sprite_factory.create() : this.active_mode_object.sprite_factory().create();
				this.foGlobals.sprite_collection.add( this.active_sprite );

				this.active_sprite.set_pos( this.absolute_pos.x, this.absolute_pos.y, this.scale );
				this.active_sprite.show( bWasVisible );
				this.active_collision_radius = this.active_sprite.collision_radius;
				this.active_spritekind = this.active_sprite.spritekind;

				this.calc_absolute();
			}
		}

		//! Resets the active_sprite to null so that nothing is active in this flying_object.
		//! But the relative_to remains and also its positions will be still calculated in frames.
		//! This method does not play any sound, especially not the sound_deactivate.
		this.disable = function()
		{
			if( this.active_sprite )
			{
				this.foGlobals.sprite_collection.remove( this.active_sprite );
				this.active_sprite = null;
				this.active_mode = kor.FlyingObjectModes.off;
				this.active_mode_object = null;
				this.active_collision_radius = 0;
				this.active_spritekind = null;
				this.active_actuator_fct = null;
			}
		}

		//! Performs one frame step.
		/*!
			The global function frame() calls it for all root flying_objects, that is which are not relative_to any other.
			In case of a relative flying_object, its frame_step_rel() will be called by the relative_to flying_object.

			When this is called, we expect all collisions having been detected already for the current frame.

			@remarks
			This is the method to be called when this flying_object is not relative_to anotherone.
			For relative flying_object's, there is frame_step_rel().
			This separation is done for speed to keep the implementation of frame_step() short, so not requiring to check for this.relative_to.
		*/
		this.frame_step = function( time )
		{
			// Now we execute the actuators.
			// frame_step() and frame_step_rel() are the only place where this is and may be done.
			// Actuators may act only on this flying_object's relative coordinates and may retrieve
			// parent's relative or absolute coordinates.
			// They may also attach/detach a flying_object to another.
			if( this.active_mode !== kor.FlyingObjectModes.off &&
				this.relative_to == null )
			{
				if( this.active_actuator_fct )
					this.active_actuator_fct( this );

				this.calc_absolute_for_abs();

				// Now that we have calculated the absolute coordinates, we animate the children.
				// We use the ordered array of the children (ordered_dictionary) so that we can be
				// sure that children with higher priority come first. That way, protectors
				// will aim on the nearest objects and guards on the further objects.
				if( this.children )
				{
					var ar = this.children.ordered;
					for( var i = 0, l = ar.length ; i < l ; ++i )
						if( ar[i] )
							ar[i].value.frame_step_rel( time );
				}
			}
		}

		//! This is frame_step but for relative flying_object's. See description to frame_step().
		this.frame_step_rel = function( time )
		{
			// Now we execute the actuators.
			// frame_step() and frame_step_rel() are the only place where this is and may be done.
			// Actuators may act only on this flying_object's relative coordinates and may retrieve
			// parent's relative or absolute coordinates.
			// They may also attach/detach a flying_object to another.
			if( this.active_actuator_fct )
				this.active_actuator_fct( this );

			if( this.relative_to )      // note: the actuator fct call might have made the object non-relative.
				this.calc_absolute_for_rel();

			// Now that we have calculated the absolute coordinates, we animate the children.
			// We use the ordered array of the children (ordered_dictionary) so that we can be
			// sure that children with higher priority come first.
			if( this.children )
			{
				var ar = this.children.ordered;
				for( var i = 0, l = ar.length ; i < l ; ++i )
					if( ar[i] )
						ar[i].value.frame_step_rel( time );
			}
		}

		//! Calculate the absolute position/orientation for this flying_object.
		//! Call this if you want to do that from outside manually.
		//! This method does not set the calculated position for the sprite itself. That should be done by the next frame step.
		this.calc_absolute = function()
		{
			if( this.relative_to )
				this.calc_absolute_for_rel();
			else
				this.calc_absolute_for_abs();
		}

		//! Calculate the absolute position/orientation for this flying_object being not relative.
		this.calc_absolute_for_abs = function()
		{
			this.absolute_pos.x = this.pos.x;
			this.absolute_pos.y = this.pos.y;
			this.absolute_orientation = this.orientation;

			// We apply the new absolute coordinates to the active_sprite.
			if( this.active_sprite )
			{
				this.active_sprite.set_pos( this.absolute_pos.x, this.absolute_pos.y, this.scale );
				if( this.active_sprite.select_circular && this.active_mode_object.select_sprite_on_orientation )
				{
					this.active_sprite.select_circular( this.absolute_orientation * kor.Vec.rezip_2PI );
					this.active_collision_radius = this.active_sprite.collision_radius;
				}
			}
		}

		//! Calculate the absolute position/orientation for this flying_object being relative.
		this.calc_absolute_for_rel = function()
		{
			var trans_pos = this.pos;

			if( this.apply_parent_orientation )
			{
				var r = kor.Vec.to_orientation( this.pos );
				trans_pos = kor.Vec.from_orientation( r + this.relative_to.absolute_orientation, kor.Vec.length( this.pos ) );

				this.absolute_orientation = (this.orientation + this.relative_to.absolute_orientation + kor.Vec.huge_2PI) % kor.Vec.twoPI;
			}
			else
				this.absolute_orientation = this.orientation;

			var s = this.relative_to.get_total_scale();
			this.absolute_pos.x = trans_pos.x * s + this.relative_to.absolute_pos.x;
			this.absolute_pos.y = trans_pos.y * s + this.relative_to.absolute_pos.y;

			// We apply the new absolute coordinates to the active_sprite.
			if( this.active_sprite )
			{
				this.active_sprite.set_pos( this.absolute_pos.x, this.absolute_pos.y, this.scale * s );
				if( this.active_sprite.select_circular && this.active_mode_object.select_sprite_on_orientation )
				{
					this.active_sprite.select_circular( this.absolute_orientation * kor.Vec.rezip_2PI );
					this.active_collision_radius = this.active_sprite.collision_radius;
				}
			}
		}

		//! Attaches to a parent flying_object by keeping the absolute position and orientation.
		this.attach = function( parent_flying_object )
		{
			this.make_relative_to( parent_flying_object );
			this.pos = kor.Vec.sub( this.absolute_pos - parent_flying_object.absolute_pos );
			this.orientation = (this.absolute_orientation - parent_flying_object.absolute_orientation + kor.Vec.huge_2PI) % kor.Vec.twoPI;
		}

		//! Detaches from a parent flying_object by keeping the absolute position and orientation.
		this.detach = function()
		{
			this.make_relative_to( null );
			this.pos = this.absolute_pos;
			this.orientation = this.absolute_orientation;
		}

		//! Beware!
		//! This does neither change the relative position & orientation nor does it do any coordinate calculations.
		//! So after having called this, the absolute coordinates will not be correct anymore.
		this.make_relative_to = function( parent_flying_object_or_null )
		{
			// unlink
			if( this.relative_to )
			{
				if( this.relative_to.children )
					this.relative_to.children.erase( this.Index );
				//else
				//	debugPanel.write( "Inconsistency detected. A flying object was relative to a parent which does not have children." );
				this.relative_to = null;
			}

			// link to new parent
			if( parent_flying_object_or_null )
			{
				this.relative_to = parent_flying_object_or_null;
				if( this.relative_to.children )
					this.relative_to.children.add( this.Index, this );
				//else
				//	debugPanel.write( "Inconsistency detected. A flying object is being made relative to a parent which does not have children." );
			}
		}

		/*!
			This is a helper function used when creating a flying_object whose starting position
			should be calculated relative to a parent object but the flying_object should not
			be attached (relative to) that parent object.

			What this method does is this:
			<code>
				this.make_relative_to( parent_flying_object );
				this.calc_absolute_for_rel();
				this.detach();
			</code>
			The only difference is that make_relative_to() would add this object to the parent's
			children array which would cause this array (which in fact is a ordered_dictionary)
			to become resorted. The problem is that this sort does not guarantee the order of
			elements recognized as equal in sort order (so with same priority). The result would
			be when doing the 3 calls above that objects of same priority are reordered and
			you can see that e.g. with guards or protectors of a player ship:
			Imagine you have 2 guards and when you start a shot and the shot is made
			relative and detached immediately on its creation, the order of the guards could
			have changed because they have same priority. The visible result is that the guards suddenly
			exchange their positions because they exchanged the nearest targets to aim on.
			To prevent that, this method can be used which will not touch the parent's children
			ordered_dictionary.
		*/
		this.calc_absolute_as_if_relative = function( parent_flying_object )
		{
			//if( parent_flying_object == null )
			//	debugPanel.write( "Hierarchy error. calc_absolute_as_if_relative requires a parent flying object." );

			// Now we make relative, but without adding to parent object's children.
			// We don't need the parent's children array for calculating This's position,
			// but we need This to know its parent object for this calculation.
			this.make_relative_to( null );
			this.relative_to = parent_flying_object;

			this.calc_absolute_for_rel();

			// Now we do the detach. We reset the relative_to because we did set it manually.
			// And then we do the remaining calculations usually done in detach().
			this.relative_to = null;
			this.detach();
		}

		this.get_total_scale = function()
		{
			return this.relative_to ?
				this.relative_to.get_total_scale() * this.scale :
				this.scale;
		}

		this.remove_collisions_of_kind = function( object_kind )
		{
			if( this.collisions )
				for( var i = 0 ; i < this.collisions.length ; ++i )
				{
					if( this.collisions[i] )
						if( this.collisions[i].object_kind === object_kind )
							this.collisions.splice( i--, 1 );
				}
		}

		/*!
			@param object_kinds
			Must be an array of object_kind's to check.
		*/
		this.remove_collisions_of_kinds = function( object_kinds )
		{
			if( this.collisions )
				for( var i = 0 ; i < this.collisions.length ; ++i )
				{
					if( this.collisions[i] )
						if( object_kinds.indexOf( this.collisions[i].object_kind ) >= 0 )
							this.collisions.splice( i--, 1 );
				}
		}

		//! Gets *one* flying_object from the detected collisions
		//! fitting the specified sprite_kind's.
		/*!
			@param sprite_kinds
			Must be an array of sprite_kind's to check.
		*/
		this.get_collision_of_sprite_kinds = function( sprite_kinds )
		{
			if( this.collisions )
				for( var i = 0 ; i < this.collisions.length ; ++i )
				{
					if( this.collisions[i] )
						if( sprite_kinds.indexOf( this.collisions[i].active_spritekind ) >= 0 )
							return this.collisions[i];
				}
			return null;
		}

		//! Gets *one* flying_object from the detected collisions
		//! fitting the specified object_kind.
		/*!
			@param sprite_kinds
			Must be an array where the indices are the sprite_kind's to check
			and the value of each array element must be true.
		*/
		this.get_collision_of_kind = function( object_kind )
		{
			if( this.collisions )
				for( var i = 0 ; i < this.collisions.length ; ++i )
				{
					if( this.collisions[i] )
						if( this.collisions[i].object_kind === object_kind )
							return this.collisions[i];
				}
			return null;
		}

		this.remove_near_objects_of_kind = function( object_kind )
		{
			if( this.near_objects )
				for( var i = 0 ; i < this.near_objects.length ; ++i )
				{
					if( this.near_objects[i].FO.object_kind === object_kind )
						this.near_objects.splice( i--, 1 );
				}
		}

		/*!
			@param object_kinds
			Must be an array of object_kind's to check.
		*/
		this.remove_near_objects_of_kinds = function( object_kinds )
		{
			if( this.near_objects )
				for( var i = 0 ; i < this.near_objects.length ; ++i )
				{
					if( object_kinds.indexOf( this.near_objects[i].FO.object_kind ) >= 0 )
						this.near_objects.splice( i--, 1 );
				}
		}

		//! Removes near objects which
		//! are either our children (e.g. if we are a ship with guards/protectors),
		//! or come from us as origin (e.g. if we are a ship with shots flying around),
		//! or come from an origin that we also have as the same origin (e.g. if we are a missile).
		this.remove_own_near_objects = function()
		{
			if( this.near_objects )
				for( var i = 0 ; i < this.near_objects.length ; ++i )
				{
					var origin_object_of_near = this.near_objects[i].FO.a_origin_object;
					if( this.near_objects[i].FO.relative_to === this ||
						origin_object_of_near === this ||
						(origin_object_of_near != null && origin_object_of_near === this.a_origin_object) )
					{
						this.near_objects.splice( i--, 1 );
					}
				}
		}

		this.keep_near_objects_of_kind = function( object_kind )
		{
			if( this.near_objects )
				for( var i = 0 ; i < this.near_objects.length ; ++i )
				{
					if( this.near_objects[i].FO.object_kind !== object_kind )
						this.near_objects.splice( i--, 1 );
				}
		}

		/*!
			Gets the nearest flying_object from the detected near_objects
			fitting the specified sprite_kind(s).

			@param sprite_kinds
			Must be an array of sprite_kind's to check.
		*/
		this.get_nearest_object_of_sprite_kinds = function( sprite_kinds )
		{
			if( this.near_objects )
				for( var i = this.near_objects.length - 1 ; i >= 0 ; --i )
				{
					if( sprite_kinds.indexOf( this.near_objects[i].FO.active_spritekind ) >= 0 )
						return this.near_objects[i].FO;
				}
			return null;
		}

		/*!
			Gets the nearest flying_object from the detected near_objects
			fitting the specified sprite_kind(s).

			Returns a { FO, distance_sqr } or null.

			@param sprite_kinds
			Must be an array of sprite_kind's to check.

			@param filterFn
			[optional]
			a function ( foNear, foCaller ) that returns true if to accept foNear as a near object
			or false if to reject it and continue search with the next further of the near_objects.
			foCaller is 'this' flying_object which invoked the filter function.
		*/
		this.get_nearest_object_data_of_sprite_kinds = function( sprite_kinds, filterFn )
		{
			if( this.near_objects )
			{
				if( filterFn )
					for( var i = this.near_objects.length - 1 ; i >= 0 ; --i )
					{
						var n = this.near_objects[i];
						if( sprite_kinds.indexOf( n.FO.active_spritekind ) >= 0 &&
							filterFn( n.FO, this ) )
						{
							return n;
						}
					}
				else
					for( var i = this.near_objects.length - 1 ; i >= 0 ; --i )
					{
						if( sprite_kinds.indexOf( this.near_objects[i].FO.active_spritekind ) >= 0 )
							return this.near_objects[i];
					}
			}
			return null;
		}

		//! Find the specified flying_object in the near_objects and return its data or null.
		this.find_in_near_objects = function( foFind )
		{
			if( this.near_objects )
				for( var i in this.near_objects )
				{
					if( this.near_objects[i].FO === foFind )
						return this.near_objects[i];
				}
			return null;
		}

		this.set_collidable = function( bCollidable )
		{
			if( bCollidable )
			{
				this.foGlobals.collidable_objects[this.Index] = this;
				this.collidable = true;
			}
			else
			if( this.collidable )
			{
				this.foGlobals.collidable_objects[this.Index] = null;
				this.collidable = false;
				this.collisions = [];
				if( this.near_objects )
					this.near_objects = [];
			}
		}

		/*!
			@remarks
			This is different to this.skip_collisions. While skip_collisions is used (e.g. when the ship is warping),
			the flying_object shall be excluded from being detected in collisions.
			Invulnerability is used when the ship shall not be destroyed (e.g. when it has the shield active),
			but other objects may detect collision with it so that that other object can e.g. destroy itself.
		*/
		this.invulnerable = function()
		{
			return this.active_mode_object ? this.active_mode_object.invulnerable : false;
		}

		/*!
			@param FO_by
			The flying_object that collided with This flying_object and is causing This one to explode.

			@return
			true if the object could be put in explosion state or if it was exploding already.
			false if the object has no explosion sprite set.
		*/
		this.explode = function( FO_by )
		{
			if( this.invulnerable() )
				return false;

			var prev_mode = this.active_mode;

			var ret = this.set_active_sprite( kor.FlyingObjectModes.explosion, true );
			if( ret && prev_mode !== kor.FlyingObjectModes.explosion )
			{
				if( this.children )
					for( var i in this.children.ordered )
						if( this.children.ordered[i] )
							this.children.ordered[i].value.relative_to_state_change = kor.RelativeTo_States.Died;

				this.exploded_by = FO_by;

				if( this.on_exploding )
					this.on_exploding();
			}

			return ret;
		}

		this.on_exploding = null;		//!< function called when the flying_object started exploding

		//! @param n the value to increase the score with. May be null which should be interpreted as 0.
		this.increase_score = function( n )
		{  }
	}



	// -- collision detection ------------------------------------------------------

	//! Detects collisions and near objects.
	/*!
		@param foGlobals
		must the same foGlobals object as the one passed to the kor.flying_object's on their construction.
		It should be {flying_objects, flying_objects_count, collidable_objects, sprite_collection, sounds_on, getTime()}.
	*/
	kor.detect_collisions = function( foGlobals )
	{
		// detect collisions
		for( var i = 0, l = foGlobals.collidable_objects.length ; i < l ; ++i )
		{
			var fly1 = foGlobals.collidable_objects[i];
			if( fly1 == null ) continue;
			if( fly1.active_sprite == null ) continue;

			// first clear all collisions for the current collidable object.
			fly1.collisions = [];

			var root1 = fly1.a_origin_object;
			if( !root1 ) root1 = fly1.relative_to;
			if( !root1 ) root1 = fly1;

			if( fly1.near_objects )
			{
				var near = [];
				var outer_dist_sqr = fly1.near_distance_sqr();		// square of the distance at which to start checking for near objects

				for( var j = 0, lj = foGlobals.flying_objects.length ; j < lj ; ++j )
				{
					var fly2 = foGlobals.flying_objects[j];
					if( fly2 == null ) continue;
					var bWantInNearObjects = !fly2.skip_collisions || (fly1.want_more_near_objects && fly1.want_more_near_objects.indexOf(fly2.active_spritekind) >= 0);
					if( !bWantInNearObjects ) continue;

					//if( fly1 === fly2 ) continue;		// this is done with root1 === root2 already, too
					var root2 = fly2.a_origin_object;
					if( !root2 ) root2 = fly2.relative_to;
					if( !root2 ) root2 = fly2;
					if( root1 === root2 ) continue;

					if( fly2.active_mode === FlyingObjectModes.off || fly2.active_mode === FlyingObjectModes.explosion )
						continue;

					var dist_sqr = kor.Vec.distance_sqr( fly1.absolute_pos, fly2.absolute_pos );
					if( !fly2.skip_collisions )
					{
						var collision_dist = fly1.active_collision_radius + fly2.active_collision_radius;
						if( dist_sqr < collision_dist * collision_dist )
						{
							fly1.collisions.push( fly2 );
						}
					}

					if( bWantInNearObjects )
					{
						if( dist_sqr < outer_dist_sqr )
							near.push({ distance_sqr: dist_sqr, FO: fly2 });
					}
				}

				near.sort(function( a, b )
				{
					return b.distance_sqr - a.distance_sqr;	// compare near objects
				});

				fly1.near_objects = near;
			}
			else
			{
				for( var j = 0, lj = foGlobals.flying_objects.length ; j < lj ; ++j )
				{
					var fly2 = foGlobals.flying_objects[j];
					if( fly2 == null ) continue;
					if( fly2.skip_collisions ) continue;

					//if( fly1 === fly2 ) continue;		// this is done with root1 === root2 already, too
					var root2 = fly2.a_origin_object;
					if( !root2 ) root2 = fly2.relative_to;
					if( !root2 ) root2 = fly2;
					if( root1 === root2 ) continue;

					if( fly2.active_mode === FlyingObjectModes.off || fly2.active_mode === FlyingObjectModes.explosion )
						continue;

					var dist_sqr = kor.Vec.distance_sqr( fly1.absolute_pos, fly2.absolute_pos );
					var collision_dist = fly1.active_collision_radius + fly2.active_collision_radius;
					if( dist_sqr < collision_dist * collision_dist )
					{
						fly1.collisions.push( fly2 );
					}
				}
			}
		}
	}
