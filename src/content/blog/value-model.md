---
title: Reward Model 存在的问题以及 Value Model 的作用
slug: value-model
date: 2026-07-31
updated: 2026-07-31
summary: ''
tags: []
draft: false
---

如果每一个采样回答的目标梯度都是由奖励值 $R$ 来加权的，这就会导致**样本梯度的幅度受到奖励值幅度的影响**，对于同一个Prompt，Reward Model 得到的分数也可能会有很大差别，导致每一个 Batch 的梯度会剧烈变化。所以只有在大量的采集样本训练后，梯度才能够逐步接近真实的期望。

为了缓解这个问题，Value Model 通过减去一个预期回报来平衡不同的奖励值，首先我们考虑原先梯度估计中的第 $t$ 个 Token：
$$
G_t \nabla_\theta \log \pi_\theta(a_t|s_t)
$$
为了平衡奖励值的高方差，我们通过给 $G_t$ 减去一个只依赖于当前状态 $s_t$ 的预期回报 $b(s_t)$ ，使得 $G_t - b(s_t)$ 的值都限制在一定的范围内，让收敛更加平稳。所以我们的 Value Model 的预测目标即 $V^\pi(s_t) = \mathbb{E}[G_t|s_t]$，也就是基于给定的状态的情况下，预测当前获得奖励的期望值，而我们可以以此计算出优势值：
$$
A_t = G_t - V^\pi(s_t)
$$
这个优势值不代表一个绝对的值，而是当前的 Token 相比于当前策略的正常表现是更好还是更差，是一个相对量，而这样也可以消除不同 Prompt 之间的难度差异（因为比较简单的 Prompt 自然会导致预期奖励本身就很高），同时原先的 Reward Model 如果整体增加一个常数，那么 Value Model 学习到的期望奖励也会增加对应的常数，所以可以抵消 Reward Model 的固有偏移。

### 加入 Value Model 是否会影响我们对真实梯度的估计

现在我们需要考虑，在 $G_t$ 上减去一个只和当前状态相关的值是否会影响估计的准确性，首先我们先表示出当前的期望：
$$
\mathbb{E}[(G_t-b(s_t))\nabla_\theta \log \pi_\theta(a_t|s_t)]
$$
拆开可以得到：
$$
\mathbb{E}[G_t\nabla_\theta \log \pi_\theta(a_t|s_t)]-\mathbb{E}[b(s_t)\nabla_\theta\log\pi_\theta(a_t|s_t)]
$$
后一项可以表示为：
$$
b(s_t)\sum_a \pi_\theta(a|s_t)\nabla_\theta \log \pi_\theta(a|s_t)
$$
利用前面提到过的对数函数求导恒等式可以得到上面的式子实际上等于：
$$
b(s_t)\sum_a \nabla_\theta \pi_\theta (a|s_t) = b(s_t) \nabla_\theta\sum_a \pi_\theta(a|s_t)
$$
又因为 $\sum_a \pi_\theta(a|s_t) = 1$ 恒成立，所以这一项的梯度为 0，这也就**保证了整体的期望仍然和只有 $G_t$ 时期望一致**。

### 使用 Value Model 为什么可以使奖励中心化

为了更准确的定义 Value Model ，我们需要先定义 Action-Value Function：
$$
Q^\pi(s_t,a_t) = \mathbb{E}[G_t|s_t,a_t]
$$
也就是，在当前的 $s_t$ 状态下，选择动作 $a_t$ 可以得到的期望回报。而我们的 Value Model 则是在当前的状态 $s_t$ 下所有可能动作的平均回报值，也就可以表示为：
$$
V^\pi(s_t) = \sum_a \pi(a|s_t)\cdot Q(s_t,a)
$$
在明确了这两个值以后，我们就可以引出优势函数：
$$
A^\pi(s_t,a_t) = Q^\pi(s_t,a_t) - V^\pi(s_t)
$$
它表示了当前选择 $a_t$ 这个动作相比于通常的策略会好多少。而对当前所有动作的 $A^\pi$ 取期望可以得到：
$$
\mathbb{E}[A^\pi (s_t,a_t)]=\mathbb{E}[Q^\pi(s_t,a_t)] - \mathbb{E}[V^\pi(s_t)]
$$
由于 $V^\pi$ 和动作无关，所以可以得到：
$$
\mathbb{E}[A^\pi (s_t,a_t)]=\mathbb{E}[Q^\pi(s_t,a_t)] - V^\pi(s_t)
$$
而本来 $\mathbb{E}[Q^\pi(s_t,a_t)]$ 从定义上就等价于 $V^\pi(s_t)$，所以可以得到：
$$
\mathbb{E}[A^\pi(s_t,a_t)]=0
$$
所以 Advantage 函数是围绕当前的策略平均表现来中心化的相对分数。

但是在真实的训练中，由于每一步采样的多样性和巨大的搜索空间，我们很难直接训练出真实的 $Q^\pi$，所以我们通过当前的 Rollout（现在采样到的一条路径）来当作 $Q^\pi$ 的一个样本，所以我们得到的 Advantage 一般是：
$$
\hat{A}_t = G_t - V^\pi(s_t)
$$
但是在大规模的采样情况下，仍然可以保证 $\hat{A}_t$ 的期望接近于 $0$。
