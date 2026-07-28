---
title: PPO算法详细推导
slug: ppo
date: 2026-07-28
updated: 2026-07-28
summary: ''
draft: false
---

### 基本的模型组成

- Policy Model

  用于生成回答的策略模型，最终得到的核心模型，该模型一般由SFT模型来初始化，在PPO的过程中一直保持参数的更新。

- Reference Model

  和Policy Model 一样，都是使用SFT模型进行的初始化，主要用于约束Policy Model不要偏离原始的SFT模型（通过KL散度）。

- Reward Model

  用于给**完整的回答**来打出一个偏好分数，一般是SFT模型的Backbone加一个标量的输出头来训练得到。

- Value Model

  

- Old Policy

### Reward Model 和 Value Model 的核心区别

Reward Model 是在一个完整的回答结束以后判断最终的结果是否是好的，而 Value Model 用于预测从当前的状态继续生产，未来能够获得多少回报。

对于Reward Model，我们一般用它来建模一个偏好，假设对于一个 Prompt $x$， 我们更喜欢的回答是 $y_w$，更不喜欢的回答是 $y_l$，可以记作：$y_w \succ y_l$，我们的 Reward Model 对于两个输出都可以计算出一个标量：
$$
r_w=r_\phi(x,y_w),r_l=r_{\phi}(x,y_l)
$$
可以使用 **Bradley-Terry 模型**定义偏好概率为（只是一个模型）：
$$
P(y_w \succ y_l|x)=\sigma(r_w-r_l), \sigma(z) = \frac{1}{1 + e^{-z}}
$$
也就是在 $x$ 作为 Prompt 的前提下，回答都存在 Reward 分数，那么我们可以通过这个模型来计算出在当前的 Reward 分数下 $y_w$ 好于 $y_l$ 的概率有多大，假设 $r_w = 2$，$r_l=-1$，那么我们可以计算出来 $P(y_w \succ y_l|x)=\sigma(3)=0.953$，就代表有 $95.3\%$ 的概率回答 $y_w$ 更好。

而我们训练这个 Reward Model 的损失函数也以此构造为：
$$
\mathcal{L}_R = -\mathbb{E}[\log P(y_w \succ y_l|x)]=-\mathbb{E}[\log \sigma(r_w-r_l)]
$$
注意，这是在我们已经标记好 $y_w$ 回答是好于 $y_l$ 的前提下。

但是 Reward Model 的一个关键问题在于，我们的偏好概率由作差来构造，所以两个奖励同时加上一个常数不会影响最终计算的概率偏好。假如两个回答都是奖励较高的回答，例如奖励分别为 $101$ 和 $98$，我们的概率偏好得分还是一致的 $95.3%$，但是实际上二者可能没有那么大的差距，所以我们在使用的时候往往需要对奖励进行统一的归一化。

如果我们直接用 Reward Model 的结果来进行策略优化，由于一个完整的序列采样过程是离散的，所以很难直接对一个序列的推理进行微分，但是我们可以对一个序列
