---
title: 注意力汇聚点：为什么第一个 token 如此重要
slug: attention-sinks
date: 2026-07-20
summary: >-
  从 KV cache 中丢掉第一个 token，模型质量的下降远超它的语义信息量所能解释的程度。
tags:
  - 可解释性
  - 注意力机制
draft: false
---

这篇文章的作用是把站点的各项能力一次性跑通：公式、代码、表格、引用和长段落。
写出真正的内容之后可以删掉它。

## 现象

如果把模型 KV cache 里的第一个 token 驱逐掉，生成质量会断崖式下跌——跌幅远超这个
token 本身携带的语义信息所能解释的程度。常见的解释框架是：softmax 必须把概率质量
分配到*某个地方*：

$$
\text{Attn}(Q, K, V) = \text{softmax}\!\left(\frac{QK^\top}{\sqrt{d_k}}\right) V
$$

由于 softmax 的分母归一化到 1，一个没有任何有用信息可关注的注意力头，仍然必须把
$\sum_i a_i = 1$ 分摊到整个序列上。第一个 token 就成了倾倒这部分质量的方便去处
——一个空操作的吸引子。

行内公式同样可用：对于被汇聚点主导的注意力头，其注意力熵
$H(a) = -\sum_i a_i \log a_i$ 会坍缩到接近零。

## 如何度量

```python
import torch

def sink_ratio(attn: torch.Tensor) -> torch.Tensor:
    """落在位置 0 上的注意力质量占比。

    attn: (batch, heads, query_len, key_len)
    """
    return attn[..., 0].mean(dim=(0, 2))  # -> (heads,)


# 超过约 0.8 的头，几乎全部是汇聚点流量。
ratios = sink_ratio(attentions)
sinks = (ratios > 0.8).nonzero().flatten()
```

## 结果

| 模型     | 汇聚点头数 | 驱逐后困惑度变化 |
| -------- | ---------- | ---------------- |
| 7B base  | 12 / 32    | +4.1             |
| 7B chat  | 15 / 32    | +6.7             |
| 70B base | 31 / 80    | +2.9             |

> 指令微调过的模型受影响始终更严重。这一点我目前还没有好的解释。

## 尚不确定的地方

1. 汇聚点是学习得到的，还是位置编码带来的副产物。
2. 在更长的上下文下这个效应是否仍然成立——这部分我还没有测过。
3. `attention_sink` 这个名字是否恰当——`softmax_ballast`（softmax 压舱物）
   或许更诚实一些。

如果你有想法，欢迎[写邮件给我](mailto:you@example.com)。
