---
title: binary autopsy report of flappy bird
date: 2026-10-12
subtitle: understanding how flappy bird works from binary level w lldb 
---

![flappy bird with lldb](https://res.ruik.ai/images/flappy.png)

I asked a LLM to write me a Flappy Bird game in plain C with no optimization and compiler symbols, just so we can understand how Flappy Bird works from an engineering standpoint by reverse engineering. In other words, reverse engineering turns out to be the best way that we approach learning engineering. How fun! In that process, I'll probably pick up some debugger skills that I left behind for a long time. So we're not only learning the game from a pseudocode level, but also "step-by-step, literally in LLDB.

## The canvas

The canvas is a character buffer `g_game.frame`, declared at `flappy.c:92`:
```c
typedef struct {
  game_state_t state;
  bird_t bird;
    typedef struct {
      float y;   /* vertical position (row, float for smooth physics) */
      float vy;  /* vertical velocity */
      int frame; /* animation frame for wing */
      int alive;
    } bird_t;
  pipe_t pipes[MAX_PIPES];
  uint32_t score;
  uint32_t hiscore;
  uint32_t games_played;
  uint64_t tick;
  int next_pipe_x;
  int difficulty; /* scroll speed divisor shrinks as score grows */
  char frame[SCREEN_H][SCREEN_W + 1];
} game_t;
```
In our case, it's a 24-row by 60-column array of chars. Its size comes from `SCREEN_W` and `SCREEN_H` at lines 31 and 32. Each frame, which render at flappy.c:548 (with lots of `cases`) fills the buffer and outputs it to the terminal, after moving the cursor home with the escape sequence at :582. 

## The state variables

As we mentioned above, everything takes place in the global structure `g_game`, which is declared at line 99. We already demonstrated above that the pointer is of type `game_t`. Specifically:
- `state` is the game-over / title / playing / paused flag as an enum.
- `bird.y` and `bird.vy` are position and vertical speed. bird.alive is the death flag.
- `pipes[6]` holds each pipe's x column, gap row, and whether it's been scored.
- `score`, `hiscore`, `games_played`, `tick` are counter variables.

We can examine this in `lldb`: e.g., the states:

```c
(lldb) p sizeof(g_game.frame)
(unsigned long) 1464
(lldb) p (char*)g_game.frame[0]
(char *) 0x0000000100bdc098 "  SCORE 1  BEST 6  LVL 1      |||               |||         "
(lldb) p (char*)g_game.frame[22]
(char *) 0x0000000100bdc5d6 "============================================================"
```
Here we first print out the `g_game.frame_size`, which is 1,464 (the result of 24 rows times 61 characters). From row 0, we can see the HUD text, and from row 22, we can see the ground line expressed using this equal sign.
```c
(lldb)  image lookup -a &g_game
      Address: flappy[0x0000000100008008] (flappy.__DATA.__bss + 0)
      Summary: flappy`g_game
(lldb) p g_game
(game_t) {
  state = STATE_DEAD
  bird = (y = 4.08002949, vy = -0.279999912, frame = 3, alive = 0)
  pipes = {
    [0] = (x = -4, gap_y = 7, scored = 1, active = 0)
    [1] = (x = 11, gap_y = 9, scored = 0, active = 1)
    [2] = (x = 29, gap_y = 6, scored = 0, active = 1)
    [3] = (x = 47, gap_y = 4, scored = 0, active = 1)
    [4] = (x = 0, gap_y = 0, scored = 0, active = 0)
    [5] = (x = 0, gap_y = 0, scored = 0, active = 0)
  }
  score = 1
  hiscore = 6
  games_played = 8
  tick = 216
  next_pipe_x = 65
  difficulty = 0
```
By printing out the memory projection of the global game variable, we can see that it's located on the BSS segment. We can print out the global game states whenever we want: as you can see here, we can see here all the bytes are, the bird's velocity, and so on.

## The game loop

`game_run` at `flappy.c:648`. The `hile` on `:649` takes place until the state becomes `quit`. Each pass it put all pending keys through `handle_key`, calls `game_tick` if playing, calls render, then sleeps for `TICK_US` :658. Which is a constant of 45000 microseconds, roughly 22 iterations per second.

```c
static void game_run(game_t *g) {
  while (g->state != STATE_QUIT && !g_got_sigint) {
    int key;
    while ((key = input_poll()) != -1)
      handle_key(g, key);

    if (g->state == STATE_PLAYING)
      game_tick(g);

    render(g);
    sleep_us(TICK_US); /*#define TICK_US 45000 /* ~22 fps */*/
  }
}

// ...

static void game_tick(game_t *g) {
  g->tick++;
  bird_update(&g->bird);
  pipes_update(g);
  score_update(g);

  if (g->tick % 4 == 0)
    g->bird.frame = (g->bird.frame + 1) & 3;

  if (!g->bird.alive || bird_collides(g))
    game_die(g);
}
```

## Input handling

For us, there is no event listener. We use a poll loop that the LLM wrote: `input_poll_fd.c` at line 191. It does an asynchronous read on the standard input channel, which works because `terminal_raw` was earlier switched, setting the terminal into raw mode to translate the arrow-up escape sequence to `W`.

From there, it goes into `handle_key` at line 598. Whenever the player presses Space or W while playing, it calls `bird_flap` at line 286, which does exactly one thing: sets the y velocity `flap_impulse`, which is -0.55. Then gravity adds 0.045 every tick until the bird is falling again.

```c
Target 0: (flappy) stopped.
(lldb) p g_game.bird.vy
(float) 0.630000114
(lldb) finish
Process 27360 stopped
* thread #1, queue = 'com.apple.main-thread', stop reason = step out
    frame #0: 0x00000001005cc994 flappy`game_run(g=<unavailable>) at flappy.c:651:19 [opt]
   648  static void game_run(game_t *g) {
   649    while (g->state != STATE_QUIT && !g_got_sigint) {
   650      int key;
-> 651      while ((key = input_poll()) != -1)
   652        handle_key(g, key);
   653
   654      if (g->state == STATE_PLAYING)
Target 0: (flappy) stopped.
(lldb) finish
Process 27360 stopped
* thread #1, queue = 'com.apple.main-thread', stop reason = breakpoint 1.1
    frame #0: 0x00000001005ccd1c flappy`handle_key(g=<unavailable>, key=32) at flappy.c:599:18 [opt]
   596  /* ------------------------------------------------------------------ */
   597
   598  static void handle_key(game_t *g, int key) {
-> 599    if (key == 'q' || key == 'Q' || key == 0x1b || key == 0x03) {
   600      g->state = STATE_QUIT;
   601      return;
   602    }
Target 0: (flappy) stopped.
(lldb) p g_game.bird.vy
(float) -0.550000012
(lldb)
```

For an example in the debugger, we first set a breakpoint when the game reaches handle_keys with the expression key == 32 (which is the space key). Then, when we press space in the game for the first time, it stops at that exact breakpoint.

By using backtrace, we can see that this was passed from game_run into handle_keys, which triggered the specific breakpoint.

Looking at the vertical velocity using print `g_game.bird.vy`, we can see the initial velocity was 0.63. After a finish, which steps out of `game_run` and then never returns, the recalculation gives us a -0.55 result of the first flap.

## Collision / win-lose logic

There are two places for collision detection:

1. Hitting the ground: in "bird_update", whenever b->y reaches `GROUND_Y` (line 305), set alive to 0.
2. Hitting the pipe: whenever the bird hits the pipe at `bird_collide` (`flappybird.c:360`), it rounds the bird's y position into a row. Then, for each active pipe, it checks if the bird's two columns overlap with the pipe's three columns. If so, it compares the y position to see if the bird is actually above the gap or below it, which calls back to `game_tick` (line 421) and causes the game to die whenever the check fails, and continue when the check does not.

```c
(lldb)  br set -f flappy.c -l 374
Breakpoint 2: where = flappy`bird_collides + 100 at flappy.c:374:17, address = 0x00000001005cd220
(lldb) c
Process 27360 resuming
Process 27360 stopped
* thread #1, queue = 'com.apple.main-thread', stop reason = breakpoint 2.1
    frame #0: 0x00000001005cd220 flappy`bird_collides(g=<unavailable>) at flappy.c:374:17 [opt]
   371      /* bird occupies columns BIRD_X .. BIRD_X+1 */
   372      if (BIRD_X + 1 < p->x || BIRD_X >= p->x + PIPE_WIDTH)
   373        continue;
-> 374      if (by < p->gap_y || by >= p->gap_y + PIPE_GAP)
   375        return 1;
   376    }
   377    return 0;
Target 0: (flappy) stopped.
(lldb) frame variable
(const game_t *) g = <no location, value may have been optimized out>

(int) by = 5
(int) i = <no location, value may have been optimized out>

(const pipe_t *) p = 0x00000001005d401c
(lldb) p g_game.pipes
(pipe_t[6]) {
  [0] = (x = 11, gap_y = 5, scored = 0, active = 1)
  [1] = (x = 29, gap_y = 6, scored = 0, active = 1)
  [2] = (x = 47, gap_y = 6, scored = 0, active = 1)
  [3] = (x = 0, gap_y = 0, scored = 0, active = 0)
  [4] = (x = 0, gap_y = 0, scored = 0, active = 0)
  [5] = (x = 0, gap_y = 0, scored = 0, active = 0)
}
```

From lld, we set the breakpoint at the Y coordinate check. As we can see, the current bird Y value (BY) is equal to the set value of five. For the first pipe, the gap Y coordinate is also five. In our case, it should be bypassing the `return` since we are triggering the second condition that uses referenced `PIPE_GAP` `#define PIPE_GAP 7`.

## Scoring

We can understand how scoring works by setting a watchpoint at the `g_game.score` variable, in our case, it'd give us a stop at `score_update`, passed from `game_tick->score_update`, just after the `g->score++` at line 386. Funnily we can also hack the `g_game.score` via `expr g_game.score = 999` mofification in `lldb`. Back to the topic, Just tell us the scoring fires every time our next pipes pass which passes into `core_update`.

```c
Watchpoint 1 hit:
old value: 0
new value: 1
Process 27360 stopped
* thread #1, queue = 'com.apple.main-thread', stop reason = watchpoint 1
    frame #0: 0x00000001005cd198 flappy`score_update(g=<unavailable>) at flappy.c:387:38 [opt]
   384      if (p->active && !p->scored && p->x + PIPE_WIDTH <= BIRD_X) {
   385        p->scored = 1;
   386        g->score++;
-> 387        g->difficulty = (int)(g->score / 15);
   388        if (g->score > g->hiscore)
   389          g->hiscore = g->score;
   390      }
Target 0: (flappy) stopped.
(lldb) bt
* thread #1, queue = 'com.apple.main-thread', stop reason = watchpoint 1
  * frame #0: 0x00000001005cd198 flappy`score_update(g=<unavailable>) at flappy.c:387:38 [opt]
    frame #1: 0x00000001005cce30 flappy`game_tick(g=<unavailable>) at flappy.c:415:3 [opt]
    frame #2: 0x00000001005cc9b8 flappy`game_run(g=<unavailable>) at flappy.c:655:7 [opt]
    frame #3: 0x00000001005cc6c4 flappy`main(argc=1, argv=0x000000016f832a00) at flappy.c:689:3 [opt]
    frame #4: 0x0000000184c9be00 dyld`start + 6992
(lldb)  expr g_game.score = 999
(uint32_t) $5 = 999
(lldb) c
Process 27360 resuming
(lldb)
```
