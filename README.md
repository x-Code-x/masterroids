Masterroids-JS-CANVAS
version 1.0

Copyright (c) 2009-2011, Roman Komary
All rights reserved.

License:
3-clause BSD license
See accompanying license file.



Masterroids-JS-CANVAS is a Javascript based implementation of my very old
game Masterroids which I once developend for OS/2 Warp in the nineties.

Masterroids-JS-CANVAS is an asteroids clone with nice graphics, additional
extras and dangers as well as multiplayer support (although just locally on the same keyboard, so not over the net).
Team mode (a player cannot destroy other players) can be switched on or off.



Requirements:

A modern browser (as of year 2011) supporting HTML 5 canvas and audio.



Game play:

Hm, surprise surprise. Shoot the asteroids!

You have keys for turning left/right, flying forward or slow down your flight.
There is one key for shooting, one for activating your shield.

Extras may appear when shooting an asteroid.
Red ones increase weaponry, blue ones add a guard, green ones add a protector.
You can pick up up to 3 extras of each kind.

A guard is a shielding object flying around your spacecraft aiming at the nearest danger.
It will disappear after having been hit 10 times.

A protector is similar, but it turns faster, and it will never disappear.
Even after your spacecraft has been destroyed and starts over with a new life, your protectors will remain.
They are the only ones remaining when reviving.

Beside extras, dangerous objects, looking like a radioactive item, can pop up when shooting asteroids.
Beware, they will hunt you.

Beside asteroids, sometimes a mine may appear.
When shooting it, it will explode everything in a certain radius around it, except for extras.
Beware not to shoot a mine when it is too near to you. It will destroy you, too. Or protect yourself with the shield.

An alien enemy ship appears from time to time. It will fly towards you and shoot at you.
Hint: You can eliminate an enemy's shot with your own shots.


Team mode can be enabled so that players cannot destroy each other.
Without team mode, players can shoot each other, guards and protectors will recognize other players as dangerous,
colliding with another player will destroy both spacecrafts, and if you are good, it is possible to eliminate
another players shot with your own one.
