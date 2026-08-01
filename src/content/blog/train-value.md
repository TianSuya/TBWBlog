---
title: Value Model 的几种训练方法
slug: train-value
date: 2026-08-01
updated: 2026-08-01
summary: ''
tags: []
draft: false
---

### 蒙特卡洛回报

为了能够训练 Value Model，我们先从它的定义开始分析，它代表当前策略下，在状态 $s_t$ 时把所有后续奖励折现到当前时间步的期望：
$$
V^\pi(s_t)=\mathbb{E}_\pi[\sum_{k=t}^T \gamma^{k-t}r_k|s_t]
$$
如果我们想要准确的计算出 $V^\pi$，那么我们就需要列举所有可能的 Action 并计算对应的奖励，这明显是不可能的，所以一个最直接的方法就是使用蒙特卡洛采样的方法来估算 $V^\pi$ 的值，来当作训练目标，假设我们当前采样到了一条轨迹，那么时刻 $t$ 的回报可以表示为：
$$
G_t=r_t + \gamma r_{t+1}+ \gamma^2 r_{t+2} + \cdots
$$
这样我们就可以将 $G_t$ 设置为训练 Value Model 的 Target：
$$
L_V = \frac{1}{2}\mathbb{E}[(V_\phi(s_t)- G_t)^2]
$$
在我们训练时，对于一个状态采样 N 条完整的轨迹，就可以得到 $G_t^1,G_t^2,\cdots,G_t^n$，这样我们的价值函数就可以估计为：
$$
V^\pi(s_t) \approx \frac{1}{N}\sum_{i=1}^N G_t^{(i)}
$$
这也是经典的蒙特卡洛估计，从随机样本的平均值来估计期望值。

### TD Error 训练目标

除了简单的蒙特卡洛方法以外，我们还可以从定义出发构造差分来进行训练，再回到我们 Value Model 的定义式，这个等式可以拆成：
$$
V^\pi(s_t) = \mathbb{E}_\pi[r_t + \gamma\sum_{k=t+1}^T\gamma^{k-(t+1)}r_k|s_{t}]
$$
当前的期望可以转换为等价的：
$$
V^\pi(s_t) = \mathbb{E}_\pi[r_t + \gamma V^\pi(s_{t+1})|s_t]
$$
如果当前的 Value Model 足够准确，那么上面的等式应该是成立的。所以我们可以构造损失函数：
$$
\mathcal{L}_V = \frac{1}{2}\mathbb{E}[(V_\phi(s_t)-(r_t+\gamma V_{\bar{\phi}}(s_{t+1})))^2]
$$
其中 $\bar{\phi}$ 表示参数冻结的状态，这样是为了不让 $t$ 时刻和 $t+1$ 时刻同时更新，导致训练不稳定，默认以 $t+1$ 时刻作为标签，在真实的 PPO 过程中，往往先使用旧的 Value Model 来计算整体的 target，再通过这些 target 训练新的 Value Model。

在实际的训练中，每一个 Token 的 Reward 还需要包含一个 KL 散度项：
$$
r_t^{KL} = -\beta[\log \pi_\text{old}(a_t|s_t)-\log \pi_\text{ref}(a_t|s_t)]
$$
最终的奖励序列就变为： $r_t=r_t^{KL}, r_T= r_T^{KL} + r_\phi(x,y)$，在最后一个 token 才有 Reward Model 的分数。这里计算 KL 散度的 old 模型一般是生成这批回答的时候冻结的策略模型快照，而 ref 则是原始的 SFT 模型，作为长期的锚点。

但是直接使用 TD Error来进行训练也存在一个问题，实际的 LLM 训练时，往往只有一个轨迹完成以后才能获得一个奖励，所以只能是从最后一个位置能够先有梯度，然后逐渐传播到前面的位置，所以它的传播会比较慢（因为方法只逐步更新附近的状态）。

### 两种训练方法存在的问题

- 关于蒙特卡洛方法，虽然奖励传播会比较快（一次直接训练一个完整的轨迹），但是由于不同的轨迹可能具有不同的 RM 分数，所以在早期采样可能存在较高的方差。
- TD Error的方法虽然传播比较慢，但是由于它建模两个相邻状态的差，所以实际采样的方差比较小，训练比较平稳。

### GAE 训练方法

GAE类似于从蒙特卡洛和 TD Error 中找到的折中点，其中我们常说的 TD Error 一般是 TD(0) ，也就是观察一步做差，如果观察两步则可以计算出 TD(1)：
$$
\hat{G}_t = r_t + \gamma r_{t+1} + \gamma^2 V_\bar{\phi}(s_{t+2})
$$
这样可以总结出我们如果观察 $n$ 步来计算的话，可以归纳为：
$$
\hat{G}_t^n = \sum_{k=t}^{n-1} \gamma^{k-t} r_k + \gamma^n V(s_{t+n}) 
$$
当前的 $n$ 越大，则使用的真实奖励值越多，越接近蒙特卡洛算法。

基于当前的定义，我们可以计算出对应的 Advantage，在观察 1 步的时候，可以得到：
$$
\hat{A}_t^1 = r_t + \gamma V(s_{t+1}) - V(s_t)
$$
其中我们可以把当前的一步误差定义为： $\delta_t = r_t + \gamma V(s_{t+1}) - V(s_t)$，也就是 $\hat{A}_t^1 = \delta_t$，这样我们再考虑两步的观察：
$$
\hat{A}_t^2 = r_t + \gamma r_{t+1} + \gamma^2V(s_{t+2}) - V(s_{t})
$$
根据 $\delta_t$ 的定义可以得到等式：
$$
\hat{A}_t^2 = \delta_t + \gamma \delta_{t+1}
$$
可以表示为更统一的形式，即：
$$
\hat{A}_t^n = \sum_{l=0}^{n-1} \gamma^l \delta_{t+l}
$$
也就是当前第 $t$ 步的 Advantage 的估计等于将所有后续步数的 Advantage 估计值折现到当前步。

而我们训练 GAE 时，不选择特定的某一步，而是将不同步长的 Advantage 的估计进行加权混合，以提升训练时的稳定性，这个混合 Advantage 可以表示为：
$$
\hat{A}^{GAE}_t = (1-\lambda) \sum^\infin_{n=1} \lambda^{n-1} \hat{A}^{(n)}_t
$$
当前的加权是一个归一化加权，因为假设第 $n$ 项的权重是 $w_n = (1-\lambda) \lambda^{n-1}$ 那么根据等比级数的收敛性：
$$
\sum^\infin_{n=1}w_n = (1-\lambda)\sum^\infin_{n=1}\lambda^{n-1} = (1-\lambda)\frac{1}{1-\lambda}=1
$$
所以这里本质上所有项的权重之和为 $1$。我们将 GAE 整理以后可以得到：
$$
\hat{A}_t^{GAE} = \sum_{l=0}^{T-t}(\lambda \gamma)^l \delta_{t+l}
$$
这里我们整理的时候，可以直接固定 $\delta_{t+l}$ 这一项，交换求和顺序，去求每一个 Advantage 项的系数，即可整理得到这个式子。

在实际的计算中，我们可以从后往前依次计算 GAE 的 Advantage 项：
$$
\hat{A}_T = \delta_T = r_T+\gamma V_\text{old}(s_{t+1}) - V_\text{old}(s_t)
$$
得到这一项以后，就可以反向计算：
$$
\hat{A}_t = \delta_t + \gamma \lambda \hat{A}_{t+1}
$$
得到每一项的 Advantage 的估计以后，就可以构造成：
$$
\hat{G}_t = \hat{A}_t + V_\text{old}(s_t)
$$
这样可以构造出损失函数：
$$
\mathcal{L}_V = \frac{1}{2} (V_\phi(s_t) - \hat{G}_t)^2
$$
我们在计算 GAE 的过程中会得到两个值，一个是 $\hat{A}$ ，一个是 $\hat{G}$ ，其中前者用于训练策略，后者用于训练价值函数，作用不同。
