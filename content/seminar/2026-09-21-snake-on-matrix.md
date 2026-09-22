---
title: Snake on Matrix
date: 2026-09-21
subtitle: Creating Snake on direct-drive matrix, with Arduino Uno and a joystick.
---

# Snake on Matrix

![R0004549](https://res.ruik.ai/images/R0004549.JPG)

I set myself up with a pretty interesting challenge that required me to use all the pins on an Arduino Uno: trying to implement Snake on a direct-drive 8x8 LED matrix, drive a joystick using the two leftover digital pins, and creating a playable snake game using all 8x8 matrix – The last time I used an 8x8 matrix was back in primary school for a biocomputer project I was working on. Wiring these matrices is really a nightmare, but the idea of being able to play Snake on it is just so tempting. So, I guess give it a shot again this time?

## A bare 8×8 LED matrix, and a joystick.

The component I chose for the output was an 8x8 LED matrix (1088AS), with 64 LEDs behind 16 pins and no controller chip of any kind. Sources I started with:

- [Control an 8x8 matrix of LEDs](https://docs.arduino.cc/built-in-examples/display/RowColumnScanning): *Turns out to be misleading, not the LED module we are using*
- [8×8 LED Matrix Display – Model 1088AS](https://www.gravityelectronic.com/shop/8-8-led-matrix-display-model-1088as-12598)
- [How to Setup LED Matrix Displays on the Arduino](https://www.circuitbasics.com/how-to-setup-an-led-matri x-on-the-arduino/): We don't need the driver, but a good low-level overview.

As I was building it up, almost every "Arduino LED matrix" tutorial online is written for a MAX7219 module matrix that is soldered to a small PCB with a driver chip on the back exposing five pins. You can install the `LedControl` library (called `LedControl`) and it works. Even for the ones that have bare 16-pin connections, it doesn't seem to be working as well.

I had a bare matrix with a six-pin architecture. I spent a while trying to reconcile the two before realizing they weren't the same component at all.  So instead, I abandoned the library approach entirely by switching to **directly** driving the matrix by multiplexing it in the software.

### Running out of pins?

Now, the idea of the engineering is to drive the matrix directly. However, driving the matrix directly costs you 16 pins: one per row, one per column. The Uno can give you D2 to D13 (since D0 and D1 are tied up by the USB serial) plus A0 to A5, so you have 18 usable pins. The matrix already takes 16 of them. The joystick, in order to control the snake game, requires three pins: VRx, VRy, and SW (which is the push button under the joystick). I only have two pins left.

So what I did is I dropped the button. The matrix now takes D2 to D13 and A2 to A5, while the joystick's two axes take A0 and A1. Instead of pressing the stick to restart the game (which is how we intuitively think to do it), you tilt it. The game already reads two axes, so a change past the threshold will restart the round. 

While we are compromising a physical control button, we are still recovering the functionality within our specific limitations. I wish I had more digital pins, but I think this might actually be better since you don't really need to move your thumb off the button and on.

### 1088AS?

With everything wired, the button figured out, the matrix model figured out, and knowing specifically how we want to do it, the display comes out as a garbled partial pattern. Roughly only four rows on one side light up in a specific way, while the rest remains dark.

The diagram I was working from shows all eight rows on one side of the package and eight columns on the other, which is what you would naturally assume. But that is not how the 1088AS is built: it interleaves row and column pins across both sides. Physical pin 9 is a row and pin 13 is a column, while they sit in the same header. 

This took me a while to realize. It was really essential for the implementation because I had already placed all my resistors, and some rows were grouped on the side. Meanwhile, some LEDs had a current path with no resistor at all, so current was coming directly from the Arduino, through an LED, to another pin, limited by nothing. 

The way I solved this is I unplugged the board before doing anything else, because I noticed some pins were going very bright. Then I started trying different pin connections and mapped the pins myself while referencing some posts on Reddit.

1. did a 220 resistor from **5V** to a jumper wire — the probe.
2. Second jumper from **GND**.
3. Hold the GND wire on one matrix pin, touch the probe to each of the other fifteen in turn.
4. When an LED lights, the probe pin is a row and the GND pin is a column, and the position of the lit LED tells you *which* row and column.

Repeating this around, sometimes across the ground pins, gave me a complete map of the package. By doing that, I was able to move the resistor into the correct lines. 

The code didn't need any change at all, since it only cares which Arduino pin is row and which is column, but not which physical matrix pin it corresponds to.

### Joystick

The last part was a little bit more straightforward, which is the fact that the joystick was mirrored: pushing up moved the stick down, and left and right were swapped as well. This is pretty intuitive to find. 

Nothing was really wrong electrically. It's just that the joystick module was mounted rotated relative to how I was holding it. In order to use it in a natural position, you also have to swap the connections between the X and Y axes.

## Final circuit 

![R0004553](https://res.ruik.ai/images/R0004553.JPG)

- Matrix rows 1-8: `13, A4, 2, 10, 9, 3, 8, 5` w/ 200 om resistors
- Matrix columns 1-8: `A5, 7, 6, 12, 4, 11, A3, A2` (direct)
- Joystick VRx, VRy: `A0`, `A1`

As you can see, these two lists look scrambled on purpose since they are not in numeric order. They are in the matrix order, which is outputted by the direct mapping process in stage three that required me to switch between positions of the resistors.

## Code

For the code implementation part, I have already covered this in my in-class presentation. 

The snake is essentially just a state machine: You read the previous state to predict the next state. You use the next state to judge whether the player is going to eat a reward, hit the wall, or hit themselves.  These three conditions determine the next state of the game. It is also worth noting that passing by the joystick state tells the system where to go.

```c

// Rows 1..8 (these lines have 220 ohm resistors)
const int ROW_PINS[8] = {13, A4, 2, 10, 9, 3, 8, 5};
// Columns 1..8 (direct wires)
const int COL_PINS[8] = {A5, 7, 6, 12, 4, 11, A3, A2};

const int JOY_X = A0;
const int JOY_Y = A1;

// If nothing lights, change to false.
const bool ROWS_ARE_ANODES = true;

const int ROW_ON   = ROWS_ARE_ANODES ? HIGH : LOW;
const int ROW_OFF  = ROWS_ARE_ANODES ? LOW  : HIGH;
const int COL_LIT  = ROWS_ARE_ANODES ? LOW  : HIGH;
const int COL_DARK = ROWS_ARE_ANODES ? HIGH : LOW;

byte fb[8];  // bit x of fb[y] = LED at (x, y)

// 3x5 pixel digits, one byte per row (bit 2 = leftmost pixel)
const byte DIGITS[10][5] = {
  {0b111, 0b101, 0b101, 0b101, 0b111},  // 0
  {0b010, 0b110, 0b010, 0b010, 0b111},  // 1
  {0b111, 0b001, 0b111, 0b100, 0b111},  // 2
  {0b111, 0b001, 0b111, 0b001, 0b111},  // 3
  {0b101, 0b101, 0b111, 0b001, 0b001},  // 4
  {0b111, 0b100, 0b111, 0b001, 0b111},  // 5
  {0b111, 0b100, 0b111, 0b101, 0b111},  // 6
  {0b111, 0b001, 0b001, 0b001, 0b001},  // 7
  {0b111, 0b101, 0b111, 0b101, 0b111},  // 8
  {0b111, 0b101, 0b111, 0b001, 0b111}   // 9
};

// ---- Game state ----
const int MAX_LEN = 64;
int snakeX[MAX_LEN], snakeY[MAX_LEN];
int len;
int dirX, dirY, nextDirX, nextDirY;
int foodX, foodY;
bool gameOver;
unsigned long lastMove, gameOverAt;
int speedMs;

void setup() {
  for (int i = 0; i < 8; i++) {
    pinMode(ROW_PINS[i], OUTPUT);
    digitalWrite(ROW_PINS[i], ROW_OFF);
    pinMode(COL_PINS[i], OUTPUT);
    digitalWrite(COL_PINS[i], COL_DARK);
  }
  randomSeed(analogRead(A0) * 31 + micros());

  startupSweep();
  resetGame();
}

void loop() {
  if (gameOver) {
    unsigned long since = millis() - gameOverAt;
    if (since < 1500) {
      // Blink the final snake
      if ((millis() / 250) % 2) drawGame();
      else memset(fb, 0, 8);
    } else {
      drawScore();
    }
    refreshDisplay();
    if (since > 2500 && joystickMoved()) resetGame();
    return;
  }

  readJoystick();
  if (millis() - lastMove >= (unsigned long)speedMs) {
    lastMove = millis();
    step();
  }
  refreshDisplay();
}

// Score = pieces of food eaten
int score() {
  return len - 3;
}

void drawScore() {
  memset(fb, 0, 8);
  int s = score();
  if (s > 99) s = 99;
  if (s < 10) {
    drawDigit(s, 2, 2);          // one digit, centered
  } else {
    drawDigit(s / 10, 0, 2);     // tens
    drawDigit(s % 10, 4, 2);     // ones
  }
}

void drawDigit(int d, int x, int y) {
  for (int r = 0; r < 5; r++) {
    for (int c = 0; c < 3; c++) {
      if ((DIGITS[d][r] >> (2 - c)) & 1) {
        int px = x + c, py = y + r;
        if (px >= 0 && px < 8 && py >= 0 && py < 8) setPixel(px, py);
      }
    }
  }
}

// Quick test: a full row moves top to bottom, then a full column left to right
void startupSweep() {
  for (int r = 0; r < 8; r++) {
    memset(fb, 0, 8);
    fb[r] = 0xFF;
    showFor(120);
  }
  for (int c = 0; c < 8; c++) {
    memset(fb, 0, 8);
    for (int r = 0; r < 8; r++) fb[r] = 1 << c;
    showFor(120);
  }
  memset(fb, 0, 8);
}

void showFor(unsigned long ms) {
  unsigned long start = millis();
  while (millis() - start < ms) refreshDisplay();
}

// Light one row at a time, fast enough to look steady
void refreshDisplay() {
  for (int r = 0; r < 8; r++) {
    for (int c = 0; c < 8; c++) {
      digitalWrite(COL_PINS[c], (fb[r] >> c) & 1 ? COL_LIT : COL_DARK);
    }
    digitalWrite(ROW_PINS[r], ROW_ON);
    delayMicroseconds(1500);
    digitalWrite(ROW_PINS[r], ROW_OFF);
  }
}

void setPixel(int x, int y) {
  fb[y] |= (1 << x);
}

void drawGame() {
  memset(fb, 0, 8);
  for (int i = 0; i < len; i++) setPixel(snakeX[i], snakeY[i]);
  if (len < MAX_LEN) setPixel(foodX, foodY);
}

bool joystickMoved() {
  int x = analogRead(JOY_X);
  int y = analogRead(JOY_Y);
  return x < 300 || x > 700 || y < 300 || y > 700;
}

void resetGame() {
  len = 3;
  for (int i = 0; i < len; i++) {
    snakeX[i] = 3 - i;
    snakeY[i] = 4;
  }
  dirX = nextDirX = 1;
  dirY = nextDirY = 0;
  speedMs = 300;
  gameOver = false;
  placeFood();
  lastMove = millis();
  drawGame();
}

void readJoystick() {
  int x = analogRead(JOY_X);
  int y = analogRead(JOY_Y);
  if (x < 300 && dirX != 1)       { nextDirX = -1; nextDirY = 0; }
  else if (x > 700 && dirX != -1) { nextDirX = 1;  nextDirY = 0; }
  else if (y < 300 && dirY != 1)  { nextDirX = 0;  nextDirY = -1; }
  else if (y > 700 && dirY != -1) { nextDirX = 0;  nextDirY = 1; }
}

void step() {
  dirX = nextDirX;
  dirY = nextDirY;
  int nx = snakeX[0] + dirX;
  int ny = snakeY[0] + dirY;

  if (nx < 0 || nx > 7 || ny < 0 || ny > 7) { endGame(); return; }

  bool eating = (nx == foodX && ny == foodY);
  int checkLen = eating ? len : len - 1;
  for (int i = 0; i < checkLen; i++) {
    if (snakeX[i] == nx && snakeY[i] == ny) { endGame(); return; }
  }

  int newLen = eating ? len + 1 : len;
  for (int i = newLen - 1; i > 0; i--) {
    snakeX[i] = snakeX[i - 1];
    snakeY[i] = snakeY[i - 1];
  }
  snakeX[0] = nx;
  snakeY[0] = ny;
  len = newLen;

  if (eating) {
    if (len >= MAX_LEN) { endGame(); return; }
    placeFood();
    if (speedMs > 100) speedMs -= 10;
  }
  drawGame();
}

void placeFood() {
  while (true) {
    int fx = random(8), fy = random(8);
    bool onSnake = false;
    for (int i = 0; i < len; i++) {
      if (snakeX[i] == fx && snakeY[i] == fy) { onSnake = true; break; }
    }
    if (!onSnake) { foodX = fx; foodY = fy; return; }
  }
}

void endGame() {
  gameOver = true;
  gameOverAt = millis();
}

```

## Technical Tidbit

![Learn How an 8×8 LED Display Works and How to Control it Using an Arduino -  Software Particles](https://softwareparticles.com/wp-content/uploads/2024/01/Phases-of-LED-Matrix-row-scanning-Part1-1-568x600.jpg)

A bare 8x8 matrix has 64 LEDs but only 16 pins, because the LEDs are connected in a grid fashion: all the anodes in a row are tied together, and all the cathodes in a column are tied together. Lighting the LED at row 3, column 5, for example, means driving row 3 high and pulling column 5 low.

The consequence is that, technically, you cannot display an arbitrary image all at once. If you manipulate two rows and two columns to light up two diagonal LEDs, the other corners of the rectangle light up as well, simply because the current has nowhere else to go. The grid can effectively only display one row at a time.

From what I learned, this display works by multiplexing. It first lights up row 0 to display its column values, blanks it, lights up row 1, blanks it, and repeats the loop. That happens fast enough that our eyes integrate the flicker into a steady image on their own, which is the same effect that makes movies work for us; it is all frame by frame.

For our implementation, the delay was around 12 milliseconds per frame, giving a refresh rate of around 80 Hz. That is quite comfortable, considering most phones use a 60 Hz screen.

However, the cost of this refresh rate is brightness: each row is only lit 1/8 of the time. The average current going through any LED (and thus its perceived brightness) is only 1/8 of what it would be if driven continuously. That is why direct-drive matrices usually look dimmer than a MAX7219 module, which drives the rows harder.

## Peer support

After showing my work to my partner Ayaan, he suggested that I should have a score point system displayed after each trial so that players can compete and compare their scores with each other. Thus, I implemented it.

The idea was really simple. Since we already have an internal state variable dedicated to the score reached, all we need to do is calculate or log the reward the snake has eaten and display that at the end of a round.

Implementing this is also straightforward:

1. We only need five rows for each number rather than using the entire LED display matrix to show the final score.
2. We only need the center 3x5 matrix to display the numbers, similar to how it works in elevators.

So all I had to do was incorporate the reward memory, hook it up to the number display, and simply display it after the termination of each session.

## Use-case reflection


