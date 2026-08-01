---
title: 如何将 Reward Model 得到的标量奖励转化为策略梯度
slug: reward-model
date: 2026-07-28
updated: 2026-07-28
summary: ''
draft: false
---

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

但是 Reward Model 的一个关键问题在于，我们的偏好概率由作差来构造，所以两个奖励同时加上一个常数不会影响最终计算的概率偏好。假如两个回答都是奖励较高的回答，例如奖励分别为 $101$ 和 $98$，我们的概率偏好得分还是一致的 $95.3%$，但是实际上二者可能没有那么大的差距，所以我们在使用的时候**往往需要对奖励进行统一的归一化**。

因为 Reward Model 是**在完整的 Token 序列采样完成以后得到的一个标量值**，所以不能够像正常的损失函数一样进行直接反向传播，如果我们直接用 Reward Model 的结果来进行策略优化，就需要先定义出一个可微的目标函数：
$$
J(\theta) = \sum_y \pi_\theta(y|x)R(x,y)
$$
这里的 $J(\theta)$ 表示我们对**每一个可能的 $y$ **都进行采样并乘上这个回答对应的奖励标量，这样就可以保证我们的目标函数可以直接反映出当前 Action Model 的好坏，我们的核心目标是最大化 $J(\theta)$ 的值，那么我们就需要对它进行求导：
$$
\nabla_\theta J(\theta) = \sum_y R(x,y)\nabla_\theta \pi_\theta(y|x)
$$
这里的关键问题在于，我们**无法遍历所有可能的 $y$ **来得到准确的目标值和梯度（计算量过大），我们就可以考虑是否可以只采样一个回答来近似，假设我们采样： $y_0 \sim \pi_\theta(x)$，直接使用这个单一的采样来估计 $J(\theta)$ 的梯度可以得到：
$$
\nabla_\theta \hat{J} = R(x,y_0)\nabla_\theta \pi_\theta(y_0|x)
$$
为了评估这种采样估计的效果，我们需要对这个采样估计来算一个期望值：
$$
\mathbb{E}_{y\sim \pi_\theta}[\nabla_\theta \hat{J}] = \sum_y \pi_\theta(y|x) R(x,y)\nabla_\theta \pi_\theta(y|x)
$$
这时候我们和准确的目标函数梯度对比可以得到的，它多出来了一项 $\pi_\theta(y|x)$，这也说明这种估计**并不是对目标梯度的无偏估计**。为了去掉这个估计的偏差，我们可以直接除掉它，也就是将我们的估计改为：
$$
R(x,y_0) \frac{\nabla_\theta\pi_\theta(y_0|x)}{\pi_\theta(y_0|x)}
$$
这样就可以保证这个估计值的期望和原有的目标函数梯度是一致的。根据一般的对数求导法则 $\frac{\mathrm{d}}{\mathrm{d}z}\log z=\frac{1}{z}$，我们可以直接带入 $z= \pi_\theta(y|x)$ 得到：
$$
\nabla_\theta \log \pi_\theta(y|x)= \frac{1}{\pi_\theta(y|x)}\nabla_\theta \pi_\theta(y|x)
$$
所以我们的无偏估计可以改写为：
$$
\nabla_\theta \hat{J}= R(x,y)\nabla_\theta \log \pi_\theta(y|x)
$$
这样我们就得到了对于某一个有 Reward 值的预测轨迹进行策略模型优化的可微目标，我们把这一条轨迹通过 $\log$ 给拆开就可以得到：
$$
\nabla_\theta \hat{J} = R(x,y)\sum_t^T \nabla_\theta \log \pi_\theta(y_t|x,y_{<t})
$$
这样我们就可以通过一条轨迹来得到一个对我们目标函数的梯度无偏估计，由于我们直接使用 Reward Model 的话，只有最后一步有奖励，那么整个奖励序列就可能是： $[0,0,0,0,R_T]$，如果这样的话，前面的 Token 贡献的梯度均为 0，导致无法学习到早期的 Token 对最终奖励的贡献，所以我们需要通过最后的奖励值来折算早期 Token 的贡献，这里可以称为 Return。

对于第 $t$ 步生成的 Token 我们可以构造 Return 为： $G_t = \sum_{k=t}^T \gamma^{k-t} r_k$，也就是在第 $t$ 步的时候把后续的所有奖励折现到当前步的 Return 值，而这个折现的系数则是 $\gamma$，由于只有最后一步存在奖励，所以我们就可以得到： $G_t=\gamma^{T-t}R_{RM}$，所以以此类推，我们可以得到每一步的奖励值：$G_T = R_{RM}, G_{T-1}=\gamma R_{RM} \dots$

往往 $\gamma<1$ 的时候，越早的位置得到的 Return 就会越小，但是在 LLM 的后训练中，我们经常使用 $\gamma=1$ 作为系数，也就是说代表每一步的奖励都和最终的奖励值相同，即 $G_t = R_{RM}$，**虽然这里的值相同，但是代表的含义并不一样**，需要区别。

这样的话，我们就可以把整体的梯度估计切换为：
$$
\nabla_\theta \hat{J} = \sum_t^T G_t \nabla_\theta \log \pi_\theta(a_t|s_t)
$$
其中 $s_t$ 表示的是 $t$ 时刻的序列状态，$a_t$ 表示的是 $t$ 时刻的决策，这样我们就把最终的梯度无偏估计写成了不同位置 Token 梯度估计的求和形式。
