import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects | Ruikai Peng",
  description: "Security research and bugs found by Ruikai Peng",
};

export default function ProjsPage() {
  return (
    <div className="container">
      <h1>Ruikai Peng</h1>
      
      <p>
        I do security research (bug-hunting) on projects I think is fun. <br />
        things i found when i was 16:
      </p>
      <ul>
        <li><a href="https://pwno.io">Pwno</a></li>
        <li><a href="https://pwno.io/blog/prompt-to-heap-overflow">Llama.cpp Tokenizer Heap-Overflow</a></li>
      </ul>

      <p>things i found when i was 15:</p>
      <ul>
        <li><a href="https://retr0.blog/blog/llama-rpc-rce">Llama.cpp RPC Heap-overflow Remote-Code Execution</a> <em>(Dec 2024 - Feb 2025)</em></li>
        <li><a href="https://retr0.blog/blog/evernote-rce">Evernote Remote-Code Execution</a> <em>(Jul 2024)</em></li>
        <li><a href="https://retr0.blog/blog/tenda-ac8-rop">Tenda AC8 Router Remote-Code Execution</a> <em>(Jun 2024)</em></li>
        <li><a href="https://retr0.blog/blog/from-gguf-model-format-metadata-rce-to-state-of-the-art-nlp-project-rces">Llama-cpp-python Remote-Code Execution</a> <em>(May 2024)</em></li>
        <li><a href="https://retr0.blog/blog/electron-math">Youdao Note Remote-Code Execution</a> <em>(Apr 2024)</em></li>
        <li>Google <a href="https://www.tensorflow.org">Tensorflow</a> Remote-Code Executions <em>(Aug 2024)</em></li>
        <li>Microsoft <a href="https://learn.microsoft.com/en-us/semantic-kernel/overview/">Semantic Kernel</a> Remote-Code Execution <em>(May 2024)</em></li>
        <li>Intel <a href="https://github.com/intel/neural-compressor">Neural Compressor</a> Remote-Code Execution <em>(Jun 2024)</em></li>
        <li>Governmental Education System Privilege Escalation <em>(CNVD-2024-15472)</em></li>
        <li><a href="https://reach.cloud/">REACH</a> XSS <em>(Feb 2025)</em></li>
      </ul>

      <p>things i found when i was 14:</p>
      <ul>
        <li><a href="https://huntr.com/">Transformers tools Remote-Code Execution</a> <em>(Mar 2024)</em></li>
        <li><a href="https://huntr.com/">Transformers checkpoint Remote-Code Execution</a> <em>(Feb 2024)</em></li>
        <li><a href="https://huntr.com/">PrivateGPT sagemaker Remote-Code Execution</a> <em>(Feb 2024)</em></li>
        <li><a href="https://huntr.com/">LoLLMs 11 Remote-Code Executions, 5 LFIs</a> <em>(Mar 2024)</em></li>
        <li><a href="https://www.managebac.com/">Managebac</a> XSS <em>(Feb 2024)</em></li>
        <li><a href="https://note.youdao.com/">Youdao Note</a> XSS <em>(Oct 2023)</em></li>
        <li><a href="https://github.com/Protosec-Research/AutoGDB">AutoGDB</a>: Recursive Agency with GDB <em>(Dec 2023 - Mar 2024)</em></li>
        <li><a href="https://github.com/Protosec-Research/BinaryChat">BinaryChat</a>: Chat to your binary <em>(Jan 2023 - Apr 2023)</em></li>
      </ul>

      <p>things when i was younger:</p>
      <ul>
        <li>Webloom Examination System Remote-Code Execution (Jan 2022) (12)</li>
        <li>Information Leakage of My Middle School (Sep 2021) (11)</li>
        <li><a href="https://github.com/Protosec-Research/PwnBERT">PwnBERT</a>: Semantic based vuln detector <em>(Mar 2023 - Apr 2023)</em></li>
        <li><a href="https://www.linkedin.com/in/ruikai-peng/details/projects/">...</a></li>
      </ul>

      <p><em>*25 CVEs, $20,000 in bounty</em></p>

      <footer className="footer-nav">
        <Link href="/" className="nav-item">home</Link>
        <Link href="/blog" className="nav-item">blog</Link>
      </footer>
    </div>
  );
}
