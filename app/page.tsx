import Link from "next/link";

export default function Home() {
  return (
    <div className="container">
      <h1>Ruikai Peng</h1>
      
      <div className="social-icons">
        <a href="https://x.com/retr0reg" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </a>
        <a href="https://www.linkedin.com/in/ruikai-peng/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
        </a>
        <a href="https://github.com/retr0reg" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
        </a>
      </div>

      <p>
        Hey, I am Ruikai Peng. <br/> I am a 16 years-old <span className="mobile-break"></span> working on the security of the lowest parts of computer systems. <br/><i>(I&apos;ve been doing this since 11.)</i>
      </p>

      <blockquote className="quote-block">
        here is very little what I do, <br/>
        book an actual <a href="https://calendar.app.google/cRjnJVTxNfZT5erN7">zoom call</a> if you want actual to know me. <br/>
        we can talk about snowboarding or musicals if you want<br/>
      </blockquote>

      <p>things about me:</p>

      <ul>
        <li>previous <a href="/projs/">bugs</a> I found</li>
        <li><a href="https://pwno.ai">Pwno</a>, founder
          <ul>
            <li>We build AIs for real-world <a href="https://pwno.io">memory security problems</a> <br/> at the innermost systems that billions used daily</li>
          </ul>
        </li>
        <li><a href="https://retr0.blog/">retr0.blog</a>, storytell of how I exploit bugs from the lowest part of computers
          <ul>
            <li className="highlight-item"><a href="https://news.ycombinator.com/item?id=43451935">exploiting a heap overflow in <code>llama.cpp</code></a></li>
            {/* <div className="footnote">^^^ once yc hackernews top 3</div> */}
            <li><a href="https://retr0.blog/blog/evernote-rce">creating a one-click rce in <code>evernote</code></a></li>
            <li><a href="https://retr0.blog/blog/tenda-ac8-rop">rop&apos;ing a <code>tenda</code> router</a></li>
            <li><a href="https://retr0.blog/blog">...</a></li>
          </ul>
        </li>
        <br/>
        <li>Youngest speaker at <a href="https://offensiveaicon.com">OAIC</a>
          <ul><li><a href="https://research.pwno.io/deductive-engine">Deductive Engine</a>: Human Inspired Taint Reasoning</li></ul>
          <ul><li>I talked about how I designed a human-inspired taint engine via LLM reasoning, and how we used it found two overflows in Unitree Robodogs' BLE stack within 20 minutes</li></ul>
        </li>
        <li>Youngest speaker at <a href="https://www.linkedin.com/feed/update/urn:li:activity:7359257033641971713/">Black Hat USA</a>
          <ul><li><a href="https://blackhat.com/us-25/briefings/schedule/#thinking-outside-the-sink-how-tree-of-ast-redefines-the-boundaries-of-dataflow-analysis-46628">Thinking Outside the Sink</a>: Dataflow and Tree-of-Thoughts</li></ul>
          <ul><li>I talked about we designed a dataflow engine inspired by Tree-of-Thoughts, and how we used it to do vulnerability discovery to PoCs generation <i>(pruning, restriction generation and that kind of stuff)</i></li></ul>
        </li>
        <li>Youngest speaker at <a href="https://zer0con.org/#speaker-section">Zer0con</a>
          <ul><li><a href="https://research.pwno.io/llama-paradox">Llama&apos;s Paradox</a>: Hardcore Inference Attack</li></ul>
          <ul><li>I talked about how I use a super fun but complex way to RCE LLama.cpp via a little heap-overflow in tensor processing.</li></ul>
        </li>
        <li>Youngest member of <a href="https://www-qbitai-com.translate.goog/2023/11/98690.html?_x_tr_sl=zh-CN&_x_tr_tl=en&_x_tr_hl=zh-CN&_x_tr_pto=wapp">Tencent Talent Program</a></li>
      </ul>
      Media stuff: 
      <ul>
      <li><a href="https://www.bugcrowd.com/blog/hacker-spotlight-ruikai-peng/">Bugcrowd: Ruikai Peng, Spotlight</a></li>
        <li><a href="https://www.bloomberg.com/news/newsletters/2025-10-29/bug-bounty-rewards-keep-growing-for-cyber-researchers-who-squash-flaws?srnd=undefined&embedded-checkout=true#:~:text=In%20Connecticut%2C%2016%2Dyear%2Dold%20Ruikai%20Peng%20often%20searches%20for%20vulnerabilities%20during%20class.%20Peng%20has%20earned%20over%20$20%2C000%20through%20ethical%20hacking%2C%20part%20of%20which%20he's%20used%20to%20bootstrap%20his%20startup%20Pwno%2C%20which%20develops%20AI%20models%20that%20detect%20the%20same%20types%20of%20vulnerabilities.">Bloomberg: 16 y/o from CT, AI cyber startup</a></li>
        <li><a href="https://docs.google.com/document/d/1IhVweSk1wON61WcfZunOqHBZNf-CEsLsOXWZ56svRrQ/edit?usp=sharing">questions</a> / <a href="/Ruikai Peng.pdf">resume</a></li>
      </ul>

      <p>fun facts:</p>
      <ul>
        <li>I did my first <a href="https://zhuanlan.zhihu.com/p/432732290">router ROP</a> at 12</li>
        <li>I can play <a href="https://www.youtube.com/watch?v=_DfQC5qHhbo">neon</a> by john mayer</li>
        <li>I played troy bolton in middle school</li>
      </ul>

      <footer className="footer-nav">
        <span className="nav-item active">home</span>
        <Link href="/blog" className="nav-item">blog</Link>
      </footer>
    </div>
  );
}
