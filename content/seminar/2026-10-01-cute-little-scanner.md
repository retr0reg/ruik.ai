---
title: cute little 3D scanner
date: 2026-09-21
subtitle: A quick journal on the quote minimum testable prototype.
image: none
---

![Prototype](https://res.ruik.ai/images/sensor_d1.png)

This week, I've been trying to build a minimal testable prototype of this "skateboard" version of the 3D scanner I am building.

Working on it isn't easy because I've never worked with stepper motors before. Hooking them up requires some learning and digging around on the internet, but how it works is actually pretty straightforward:

1. For some reason, the stepper motor uses a four-pin connection.
2. For the Arduino, you simply connect the D1 to D4 pins to pins 7, 8, 9, and 10.
3. I think three of those Arduino pins are capable of emitting more complex signals.

After that, you also need to hook the ultrasonic sensor into the Arduino, which is where I ran into my first tiny problem. The Arduino Uno only has one 5V pin. 

How I fixed this was by grabbing a tiny breadboard and putting the 5V in series, so both the ultrasonic sensor and the driver can share the same 5V pin. 

This is also where I made a major mistake by shorting the 5V and the ground. That made the Arduino unable to boot up, but I discovered the problem after about 30 seconds.

Afterwards, I had a little problem fixing the ultrasonic sensor on the stepper motor, but the solve was pretty straightforward. All you need to do is put glue on it, touching the metal part of the ultrasonic sensor and sticking that onto the stepper motor. That gave the motor the balance and the forces needed to stick on it.

Lastly, we have collecting the data. The data collection is pretty simple: all you need is the angle and the distance sensor data that came from the ultrasonic sensor. 

Afterwards, what we need to do is create a graph out of it. We do that by utilizing the unit circle, substituting the x and y coordinates using cosine and sine.
