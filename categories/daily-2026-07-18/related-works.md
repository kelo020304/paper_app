# 每日精选 2026-07-18 — Related Works

## 总览

RoboTTT 位于长上下文机器人策略、测试时训练（TTT）记忆与视觉语言动作（VLA）基础模型的交汇处。其核心不只是扩大历史窗口，而是将连续视觉—动作流压缩为可持续更新的快速权重，并在实时闭环控制中扩展预训练上下文。在 GR00T N1.7 的 flow-matching 动作头上，上下文由 128 扩展至 8K 时性能持续提升；在 30 Hz 下，8K 对应超过四分钟历史。

与之相邻的最新路线从另一侧提升时序决策：FoMoVLA 以未来视觉表征和稀疏运动轨迹监督增强动作生成，DriftWorld 则以快速动作条件世界模型支持候选动作的前瞻评估。它们都强调控制需要动态信息，但分别补强“看见未来”和“快速模拟未来”；RoboTTT 的重点仍是从已发生的长历史中形成可更新的策略记忆。

## 长上下文与机器人策略记忆

RT-1、RT-2、OpenVLA、π0、GR00T N1 及部分 WAM 通常以当前帧为主；RDT-1B、Octo、SmolVLA 等虽可利用连续帧，但常见窗口约为 2–8 帧。TraceVLA 通过视觉轨迹提示补充时序信息，Past-Token Prediction 预测过去动作，ContextVLA 压缩多帧上下文，Gated Memory Policy 则缓存并门控历史。这些方法都试图扩大策略可见的过去，但多采用固定窗口或固定形式的记忆。

另一类工作以选择性摘要应对长历史：BPP 使用关键历史帧，MEM 构建多尺度具身记忆，其他方法则借助关键帧或语言形成高层记忆。RoboTTT 不显式检索或预设摘要，而是直接处理连续视觉—动作流，通过快速权重更新实现保留与遗忘；记忆内容由任务外层损失塑造，而非由人工规定的摘要结构决定。

FoMoVLA 所使用的 foresight token 与该类记忆并不相同：其 token 是对未来视觉状态的紧凑预测，并作为运动生成的条件，目的是把预期终态与到达该终态的轨迹相连，而非保存已发生的长历史。因此，FoMoVLA 与 RoboTTT 可被视为互补的时间建模方向：前者为当前决策注入面向未来的动态线索，后者为策略维持面向过去的、持续更新的任务状态。

整段自回归历史模型，如 Decision Transformer 类方法，能够表达远程依赖，但 KV-cache 的解码成本会随历史增长，限制长时程实时部署。LSTM 等 RNN 虽保持常数级推理复杂度，却通常难以匹配全注意力模型的大规模建模能力。RoboTTT 将快速权重作为递归状态，试图兼顾线性复杂度与更高容量的状态更新；其 GDN 对照表明，线性复杂度递归本身并不足以从更长预训练上下文中获益。

历史还可能引入 causal confusion 或 copycat 问题：策略会依赖过去观测中泄露的自身动作，而非真正理解当前任务状态。已有研究以历史摘要、辅助目标或选择性跳过上下文缓解这一风险。RoboTTT 的解释是，快速权重能够动态编码任务相关内容并丢弃冗余特征；这应视为实验支持的机制假说，而非形式化保证。

## 测试时训练与快速权重记忆

测试时训练研究通常通过自监督目标在部署时更新模型，以适应分布变化。TTT／Learning to Learn at Test Time 进一步将快速权重作为比普通隐状态更具表达力的递归记忆，Titans、TTT3R 及部分视频生成工作则将这一范式推进到长序列和连续视觉建模。

RoboTTT 延续了“训练与推理均更新快速权重、将上下文压缩到参数空间”的基本思想，但将其置于 VLA 的 flow-matching DiT 动作头中，并面向超长机器人轨迹采用 sequence action forcing 与 TBPTT。它关注的不是一次性的领域适配，而是在控制过程中持续积累和更新历史。

这也区别于 Evolve-VLA、On-the-fly VLA adaptation、TTT-Parkour 等同样使用“test-time training”表述的方法：后者通常需要在测试任务中额外收集数据并微调整体模型。VITA 与 RoboTTT 更接近，因为同样采用快速权重，但其目标是适配 VLM 价值函数；RoboTTT 则直接学习视觉运动控制策略。论文还将 Algorithm Distillation 的“把学习过程蒸馏进序列模型”具体化为 DAgger Distillation：将失败动作保留为上下文、以人工纠正作为目标，区别于标准 DAgger 主要用纠正数据拟合策略的做法。

## 机器人基础模型、动态前瞻与动作生成

VIMA、RT-2、OpenVLA、π0、RDT-1B、GR00T 等机器人基础模型大多从视觉—语言预训练表示出发，再接入动作生成模块。动作建模上，RT-2 等采用离散动作 token 的自回归预测；π0、RDT-1B 与 GR00T N1.7 等则采用扩散或 flow-matching 的连续动作头。RoboTTT 的定位是可插拔的序列模块：原则上可服务于不同机器人基础模型，但本文仅在带 flow-matching 动作头的 GR00T N1.7 上实例化，因此对离散动作模型或其他 VLA 骨干的可迁移性仍有待实证。

FoMoVLA 处于连续动作生成与预测式 VLA 的交叉点。WorldVLA、DreamVLA、UniVLA、LaRA-VLA、HiF-VLA 等通过显式或隐式未来预测辅助决策；其中像素级未来帧生成或生成—动作交错方法信息丰富，但也带来较高计算成本和控制无关的静态细节。VLA-JEPA、FUTURE-VLA、LDA-1B 与 World Guidance 等则转向潜在或特征空间预测，以更紧凑的表示提供未来线索。

FoMoVLA 没有改变 StarVLA-GR00T 的 flow-matching 动作范式，而是在训练期引入未来特征与运动监督：它将未来特征压缩为少量 foresight token，并显式条件化后续点轨迹预测。与仅以未来表征提示终态的方法相比，其关键主张是学习“如何到达”而非仅预测“将到哪里”。这一设计也区别于 FlowVLA 的像素级光流、JOPAT 的联合二维轨迹/可见性/动作去噪，以及 Spatial Forcing、GeoPredict 的教师几何或运动学蒸馏：FoMoVLA 使用冻结 CoTracker-v3 提供 patch 对齐的稀疏二维轨迹，并通过 FCCA 将未来状态和运动轨迹耦合；其消融显示，该耦合优于共享 token 或彼此独立的多任务监督。

更进一步，动作条件世界模型将未来预测用于候选行为的评估。World Models、Dreamer 等在潜空间学习动态并支持想象式优化；UniSim、GAIA-1、Genie、Cosmos，以及面向机器人操控的 IRASim、Ctrl-World、UWM、Veo-Robotics，则将其推进到高保真、细粒度的视觉模拟。DriftWorld 与这些方法共享“给定动作预测未来观测”的目标，但其重点是生成速度：通过拟合漂移场，在推理时以单次前向生成动作条件未来，而非依赖多步扩散采样或自回归展开。

这一思路与 Progressive Distillation、Consistency Models、Rectified Flow、ADD 及视频中的少步生成方法同属快速生成脉络；但 DriftWorld 进一步将 Generative Modeling via Drifting 的单步机制适配到动作条件序列预测，包括一条件一真实未来的正样本构造、逐帧动作对齐、特征空间漂移与运动加权。它本身不提出新的规划器，而是沿用 GPC-RANK 对候选动作进行在线重排序，并以模拟分数与真实 IoU／成功率的相关性验证离线排序价值。

因此，RoboTTT、FoMoVLA 与 DriftWorld 对应三种互补的时间信息来源：RoboTTT 从长期交互历史形成策略记忆，FoMoVLA 从预测未来状态约束运动生成，DriftWorld 则通过快速视觉 rollout 比较候选动作。RoboTTT 最直接的贡献仍是证明超长、连续历史可以在实时闭环控制中获得可扩展收益，而不是构建显式未来预测或世界模型。