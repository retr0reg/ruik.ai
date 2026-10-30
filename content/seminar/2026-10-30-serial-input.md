---
title: Flappy with serial input
date: 2026-10-30
subtitle: Using USB serial as input for flappy bird.
----

- Your plan: what sensor and how/why you expect it to interface with your game
- Your process: how you got the Arduino sending meaningful values & read them in Python
- Your result; show us a demo of the final project

## Planning

My plan is that I use an ultrasound sensory as the input for my flappy bird game implemented in `C`. I find this idea interesting since it combines both physical space with my pseudo-physics in the flappy bird. So it's sort projecting the physicals into digital, that sounds like a hippy idea isn't it.

1. I used an HC-SR04 ultrasonic distance sensor on an Arduino as a hands-free controller for a terminal Flappy Bird I wrote in C. The sensor fires a 40 kHz ping and times the echo, so it reports the distance to the nearest object about 40 times a second, from roughly 2 cm to 4 m.
2. Flappy Bird only needs one input, a flap, so I chose a sensor that gives one continuous number and turned that number into a button. The idea is to hold a hand about 25 cm above the sensor and bob it down. As the distance drops, the software sees it cross a threshold, and the bird flaps. Lifting the hand re-arms it for the next flap.
3. I expected the chain to be: hand, sensor, Arduino printing centimetres over USB serial, a Python script reading those numbers, and Python sending a spacebar press into the game. Thus we are not corrupting the integrity of the game. i.e., we are just overlaying a input pipeline atop of the game.

## Process

- On the Arduino side. I referenced from the ProjectHub tutorial wiring: VCC to 5V, GND to GND, Trig to pin 9, Echo to pin 10. The sketch pulses Trig high for 10 microseconds, then uses pulseIn with a 30 ms timeout to measure how long Echo stays high. Distance in cm is that time times 0.0343 divided by 2, since the sound travels out and back. The sketch prints one distance per line at 115200 baud every 25 ms, and prints -1 when no echo returns. I kept the ping interval at 25 ms because the sensor misreads if pinged faster than about every 20 ms. From the serial input monitor, you can see 'F' begin inputted.

- On teh Python side. The script opens the serial port with Python's standard os and termios modules, sets raw mode at 115200 baud, and reads whatever bytes are available without blocking. It splits them into lines and converts each to an integer, ignoring anything that isn't a number. - it later opens up a pseudo-terminal that writes a space when the detector fires, which changes the birds vertical velocity.

The interesting part is turning noisy inputs into a clean button. A single threshold flickers when the hand sits right at the edge, so I used two. Below 12 cm counts as "in the zone" and fires one flap, then disarms. Above 18 cm re-arms. Between 12 and 18 nothing changes. i.e., one dip equals one flap no matter how long the hand hovers or how much the reading jitters.

## Result

First your hand dip then the distance drop, it go through the detector then inputs the a spacebar, bird flaps. 

If I continued, I would map hand height directly to bird height instead of dip-to-flap, since the sensor already gives a continuous value, and replace delay in the sketch with a `millis` timer so serial writes never stall a ping. (i.e., the async approach)
