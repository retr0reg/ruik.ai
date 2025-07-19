### Summary

`Llama.cpp`'s `bin/llama-gguf` provided a deserialization and interpretation binary for `GGUF` structuralized model information (`file header`, `n_kv`, `Tensor`). It enables non-inference extraction of `GGUF` model information offering similar to `Hugging Face`’s `GGML Interpreter`.

However, lack of constrain on `tensor` data/offset in `gguf_ex_read_1:llama-gguf:gguf.cpp:209` 's `tensor` extraction process allowed heap-based-overflow with specially manipulated `cur->data` pointer (constructed by `tensor_offset` in `GGUF` format construction) (described as `ASAN logs`)

### Details

```cpp
    {
        const int n_tensors = gguf_get_n_tensors(ctx);
        for (int i = 0; i < n_tensors; ++i) {
            printf("%s: reading tensor %d data\n", __func__, i);
            const char * name = gguf_get_tensor_name(ctx, i);
            struct ggml_tensor * cur = ggml_get_tensor(ctx_data, name);
            printf("%s: tensor[%d]: n_dims = %d, name = %s, data = %p\n", __func__, i, ggml_n_dims(cur), cur->name, cur->data);
            const float * data = (const float *) cur->data;
            // here the cur->data pointer is effected by the tensor-offset setting during model-serialization, showcased in gguf_ex_read_0
            printf("%s data[:10] : ", name);
            for (int j = 0; j < MIN(10, ggml_nelements(cur)); ++j) {
                printf("%f ", data[j]); // overflow based on data[j]<-(const float *) cur->data;
            }
            printf("\n\n")
            if (check_data) {
                const float * data = (const float *) cur->data;
                for (int j = 0; j < ggml_nelements(cur); ++j) {
                    if (data[j] != 100 + i) {
                        fprintf(stderr, "%s: tensor[%d]: data[%d] = %f\n", __func__, i, j, data[j]);
                        gguf_free(ctx);
                        return false;
                    }
                }
            }
        }
    }
```

### Proof-Of-Concept

`bin/llama-gguf` on `dab76c92cc63072d9495ba87f2f3f3a4872d4f57` (Current Latest Commit at `Mon Dec 23 12:43:19 PM EST 2024`) built with `cmake .. -DGGML_RPC=ON -DCMAKE_BUILD_TYPE=Debug -DCMAKE_CXX_FLAGS="-fsanitize=address -g -O1" -DCMAKE_C_FLAGS="-fsanitize=address -g -O1"`

- `0211143169d478bffca4bdd90c1a243a` [`llama-gguf`](https://drive.google.com/file/d/1gEb23No_ig1HmASdgTINrj9MZF_lbDuK/view?usp=sharing)
- `3fd4d74a70c264a4d4e42876cf8aba14` [`example.gguf`](https://drive.google.com/file/d/10g6ScQZLh77Qs_dvkoqbuzNdLxcfN1jp/view?usp=sharing)

```
gguf_ex_read_0: version:      3
gguf_ex_read_0: alignment:   64
gguf_ex_read_0: data offset: 320
gguf_ex_read_0: n_kv: 5
gguf_ex_read_0: kv[0]: key = general.architecture
gguf_ex_read_0: kv[1]: key = llama.block_count
gguf_ex_read_0: kv[2]: key = answer
gguf_ex_read_0: kv[3]: key = answer_in_float
gguf_ex_read_0: kv[4]: key = general.alignment
gguf_ex_read_0: find key: some.parameter.string not found.
gguf_ex_read_0: n_tensors: 3
gguf_ex_read_0: tensor[0]: name = tensor1, offset = 0
gguf_ex_read_0: tensor[1]: name = tensor2, offset = 4096
gguf_ex_read_0: tensor[2]: name = tensor3, offset = 8192
gguf_ex_read_1: version:      3
gguf_ex_read_1: alignment:   64
gguf_ex_read_1: data offset: 320
gguf_ex_read_1: n_kv: 5
gguf_ex_read_1: kv[0]: key = general.architecture
gguf_ex_read_1: kv[1]: key = llama.block_count
gguf_ex_read_1: kv[2]: key = answer
gguf_ex_read_1: kv[3]: key = answer_in_float
gguf_ex_read_1: kv[4]: key = general.alignment
gguf_ex_read_1: n_tensors: 3
gguf_ex_read_1: tensor[0]: name = tensor1, offset = 0
gguf_ex_read_1: tensor[1]: name = tensor2, offset = 4096
gguf_ex_read_1: tensor[2]: name = tensor3, offset = 8192
gguf_ex_read_1: reading tensor 0 data
gguf_ex_read_1: tensor[0]: n_dims = 1, name = tensor1, data = 0x51d0000001f0
tensor1 data[:10] : 100.000000 100.000000 100.000000 100.000000 100.000000 100.000000 100.000000 100.000000 100.000000 100.000000 

gguf_ex_read_1: reading tensor 1 data
gguf_ex_read_1: tensor[1]: n_dims = 1, name = tensor2, data = 0x51d0000011f0
=================================================================
==167323==ERROR: AddressSanitizer: heap-buffer-overflow on address 0x51d0000011f0 at pc 0x62cd2f6c7d3c bp 0x7fffb35fbcf0 sp 0x7fffb35fbce0
READ of size 4 at 0x51d0000011f0 thread T0
    #0 0x62cd2f6c7d3b in gguf_ex_read_1 /home/retr0reg/Git-Projects/llama.cpp/examples/gguf/gguf.cpp:209
    #1 0x62cd2f6c7d3b in main /home/retr0reg/Git-Projects/llama.cpp/examples/gguf/gguf.cpp:257
    #2 0x758c7462a1c9 in __libc_start_call_main ../sysdeps/nptl/libc_start_call_main.h:58
    #3 0x758c7462a28a in __libc_start_main_impl ../csu/libc-start.c:360
    #4 0x62cd2f6c4ae4 in _start (/home/retr0reg/Git-Projects/llama.cpp/gguf-py/examples/llama-gguf+0x4ae4) (BuildId: 99ca4639e3095559956029d36cfb28d9ac5dc996)

0x51d0000011f0 is located 2224 bytes after 2240-byte region [0x51d000000080,0x51d000000940)
allocated by thread T0 here:
    #0 0x758c74efcf1d in posix_memalign ../../../../src/libsanitizer/asan/asan_malloc_linux.cpp:145
    #1 0x758c74d1f834 in ggml_aligned_malloc /home/retr0reg/Git-Projects/llama.cpp/ggml/src/ggml.c:270

SUMMARY: AddressSanitizer: heap-buffer-overflow /home/retr0reg/Git-Projects/llama.cpp/examples/gguf/gguf.cpp:209 in gguf_ex_read_1
Shadow bytes around the buggy address:
  0x51d000000f00: fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa
  0x51d000000f80: fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa
  0x51d000001000: fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa
  0x51d000001080: fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa
  0x51d000001100: fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa
=>0x51d000001180: fa fa fa fa fa fa fa fa fa fa fa fa fa fa[fa]fa
  0x51d000001200: fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa
  0x51d000001280: fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa
  0x51d000001300: fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa
  0x51d000001380: fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa
  0x51d000001400: fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa fa
Shadow byte legend (one shadow byte represents 8 application bytes):
  Addressable:           00
  Partially addressable: 01 02 03 04 05 06 07 
  Heap left redzone:       fa
  Freed heap region:       fd
  Stack left redzone:      f1
  Stack mid redzone:       f2
  Stack right redzone:     f3
  Stack after return:      f5
  Stack use after scope:   f8
  Global redzone:          f9
  Global init order:       f6
  Poisoned by user:        f7
  Container overflow:      fc
  Array cookie:            ac
  Intra object redzone:    bb
  ASan internal:           fe
  Left alloca redzone:     ca
  Right alloca redzone:    cb
==167323==ABORTING
```

### Impact

Heap-based-overflow, ranges decided by `ggml_nelements` (`tensor->ne[0]*tensor->ne[1]*tensor->ne[2]*tensor->ne[3]`) defined, `0x20` (lowest alignment requirement for `ne[0]` size) to considerably large size with No Upper Bound (`tensor->ne[]`'s element size is not-constrained)

[  
](https://huntr.com/users/retr0reg)