# 每日精选 2026-07-18 — Related Works

## 总览

RoboTTT 位于长上下文机器人策略、测试时训练（TTT）记忆与视觉语言动作（VLA）基础模型的交汇处。其核心不只是扩大历史窗口，而是将连续视觉—动作流压缩为持续更新的快速权重，并在实时闭环控制中扩展预训练上下文。在 GR00T N1.7 的 flow-matching 动作头上，上下文由 128 扩展至 8K 时性能持续提升；在 30 Hz 下，8K 对应超过四分钟历史。

与之相邻的工作从不同时间尺度补强具身决策：FoMoVLA 以预测的未来视觉表征和稀疏运动轨迹约束动作生成，DriftWorld 以快速动作条件世界模型评估候选行为；Instant NuRec 则将可自由重定位的三维驾驶仿真世界前馈化；Open-AoE 提供从自然第一视角采集、结构化处理到模型接入的人类操作数据链路。前两者主要改变策略如何利用未来，后两者分别扩展可模拟环境与可学习的人类交互经验；RoboTTT 的重点仍是从已发生的长历史中形成可更新的策略记忆。

## 长上下文与机器人策略记忆

RT-1、RT-2、OpenVLA、π0、GR00T N1 及部分 WAM 通常以当前帧为主；RDT-1B、Octo、SmolVLA 等虽可利用连续帧，但常见窗口约为 2–8 帧。TraceVLA 通过视觉轨迹提示补充时序信息，Past-Token Prediction 预测过去动作，ContextVLA 压缩多帧上下文，Gated Memory Policy 则缓存并门控历史。这些方法都试图扩大策略可见的过去，但多采用固定窗口或固定形式的记忆。

另一类工作以选择性摘要应对长历史：BPP 使用关键历史帧，MEM 构建多尺度具身记忆，其他方法则借助关键帧或语言形成高层记忆。RoboTTT 不显式检索或预设摘要，而是直接处理连续视觉—动作流，通过快速权重更新实现保留与遗忘；记忆内容由任务外层损失塑造，而非由人工规定的摘要结构决定。

整段自回归历史模型，如 Decision Transformer 类方法，能够表达远程依赖，但 KV-cache 的解码成本会随历史增长，限制长时程实时部署。LSTM 等 RNN 虽保持常数级推理复杂度，却通常难以匹配全注意力模型的大规模建模能力。RoboTTT 将快速权重作为递归状态，试图兼顾线性复杂度与更高容量的状态更新；其 GDN 对照表明，线性复杂度递归本身并不足以从更长预训练上下文中获益。

历史还可能引入 causal confusion 或 copycat 问题：策略会依赖过去观测中泄露的自身动作，而非真正理解当前任务状态。已有研究以历史摘要、辅助目标或选择性跳过上下文缓解这一风险。RoboTTT 将快速权重解释为能够动态编码任务相关内容并丢弃冗余特征；这应视为实验支持的机制假说，而非形式化保证。

## 测试时训练与快速权重记忆

测试时训练研究通常通过自监督目标在部署时更新模型，以适应分布变化。TTT／Learning to Learn at Test Time 进一步将快速权重作为比普通隐状态更具表达力的递归记忆，Titans、TTT3R 及部分视频生成工作则将这一范式推进到长序列和连续视觉建模。

RoboTTT 延续了“训练与推理均更新快速权重、将上下文压缩到参数空间”的基本思想，但将其置于 VLA 的 flow-matching DiT 动作头中，并面向超长机器人轨迹采用 sequence action forcing 与 TBPTT。它关注的不是一次性的领域适配，而是在控制过程中持续积累和更新历史。

这也区别于 Evolve-VLA、On-the-fly VLA adaptation、TTT-Parkour 等同样使用“test-time training”表述的方法：后者通常需要在测试任务中额外收集数据并微调整体模型。VITA 与 RoboTTT 更接近，因为同样采用快速权重，但其目标是适配 VLM 价值函数；RoboTTT 则直接学习视觉运动控制策略。论文还将 Algorithm Distillation 的“把学习过程蒸馏进序列模型”具体化为 DAgger Distillation：将失败动作保留为上下文、以人工纠正作为目标，区别于标准 DAgger 主要用纠正数据拟合策略的做法。

## 未来表征、动作生成与快速世界模型

VIMA、RT-2、OpenVLA、π0、RDT-1B、GR00T 等机器人基础模型大多从视觉—语言预训练表示出发，再接入动作生成模块。动作建模上，RT-2 等采用离散动作 token 的自回归预测；π0、RDT-1B 与 GR00T N1.7 等则采用扩散或 flow-matching 的连续动作头。RoboTTT 的定位是可插拔的序列模块：原则上可服务于不同机器人基础模型，但本文仅在带 flow-matching 动作头的 GR00T N1.7 上实例化，因此对离散动作模型或其他 VLA 骨干的可迁移性仍有待实证。

FoMoVLA 处于连续动作生成与预测式 VLA 的交叉点。WorldVLA、DreamVLA、UniVLA、LaRA-VLA、HiF-VLA 等通过显式或隐式未来预测辅助决策；像素级未来帧生成或生成—动作交错方法信息丰富，但也带来较高计算成本和控制无关的静态细节。VLA-JEPA、FUTURE-VLA、LDA-1B 与 World Guidance 则转向潜在或特征空间预测，以紧凑表示提供未来线索。

FoMoVLA 没有改变 StarVLA-GR00T 的 flow-matching 动作范式，而是在训练期引入未来特征与运动监督：它将未来特征压缩为少量 foresight token，并显式条件化后续点轨迹预测。其关键不只是预测终态，而是把“将到哪里”与“如何到达”耦合。与 FlowVLA 的像素级光流、JOPAT 的二维轨迹／可见性／动作联合去噪，以及 Spatial Forcing、GeoPredict 的教师几何或运动学蒸馏相比，FoMoVLA 使用冻结 CoTracker-v3 提供 patch 对齐的稀疏二维轨迹，并通过 FCCA 耦合未来状态和运动轨迹。

动作条件世界模型则将未来预测用于候选行为评估。World Models、Dreamer 在潜空间学习动态并支持想象式优化；UniSim、GAIA-1、Genie、Cosmos 及面向机器人操控的 IRASim、Ctrl-World、UWM、Veo-Robotics 将其推进到更高保真视觉模拟。DriftWorld 与这些方法共享“给定动作预测未来观测”的目标，但其重点是生成速度：通过拟合漂移场，在推理时以单次前向生成动作条件未来，而非依赖多步扩散采样或自回归展开。它沿用 GPC-RANK 对候选动作在线重排序，因此贡献主要在于为已有规划环节提供快速、可排序的 rollout，而非提出新的规划器。

## 三维重建与可闭环驾驶仿真

驾驶场景神经重建从 Urban Radiance Fields、Block-NeRF 的逐场景辐射场，发展到 NSG、EmerNeRF、NeuRAD 等动态与传感器建模，并在 3D Gaussian Splatting 表示下获得 DrivingGaussian、Street Gaussians 等更快的渲染与编辑能力。OmniRe 进一步分解静态背景、刚体和非刚体主体，3DGRT、3DGUT 则覆盖畸变相机与更复杂的成像过程。这一路线能产出仿真所需的显式世界，但通常依赖逐片段优化和丰富辅助输入。

Instant NuRec 将这类分层 3DGS 世界的求解摊销为单次前馈推理，并以 3DGUT 原生处理非针孔相机。它与 pixelSplat、MVSplat、GS-LRM、DepthSplat 等从稀疏有位姿图像直接预测 Gaussian 的前馈重建方法共享快速重建目标；也与 DUSt3R、NoPoSplat、AnySplat 等降低位姿依赖的路线相邻。其区别在于不止追求 RGB 新视角合成，而是显式预测静态／动态层、动态轨迹、天空 cubemap、法线和语义，使输出直接面向可导航、可闭环的仿真状态。

在动态驾驶场景中，STORM、DrivingForward、DGGT、ReconDrive／StreetForward、Ground4D 已将前馈 Gaussian 扩展到时空、因果或无位姿设置；TokenGS、UniQueR、GlobalSplat 则以可学习查询替代“一像素一 Gaussian”的绑定。Instant NuRec 结合查询式 Gaussian 解码，并利用语义把可移动区域纳入动态层，因此与将全部内容统一按动态 Gaussian 处理的方法形成结构性差异。

它也与 GAIA-1、DriveDreamer、MagicDrive、Panacea、Vista、GAIA-2、DrivingWorld、Epona 及 Cosmos-Drive-Dreams 等驾驶世界模型互补：后者主要按历史、轨迹、布局或文本生成二维观测，擅长补全与可控生成，却不天然提供供规划器自由重定位的显式三维状态。DriveDreamer4D、DreamDrive、ReconDreamer、Difix3D+、DiffusionHarmonizer 等使用生成先验辅助重建或修复，提示两者可结合：Instant NuRec 可作为快速几何骨干，生成模型则用于未观测区域补全与外观修复。

## 第一视角操作数据与人类—机器人接口

开放第一视角数据可从视频规模、几何监督和可执行接口三个维度理解。EPIC-KITCHENS-100 与 Ego4D 提供广泛的日常活动视频和语言语境，但缺少直接的手姿态或相机轨迹；HOI4D 提供 RGB-D、手／物姿态、分割和重建几何，HOT3D 则以多视角动捕获得更强几何真值。EgoMimic、EgoDex、EgoLive 分别扩展了相机运动、手部跟踪、灵巧操作时长或立体高帧率观测。

Open-AoE 的定位不在最大规模或最高传感器保真度，而在完整的开放数据循环：以 400 余种消费级手机和 500 余名贡献者在自然环境连续采集，再共同发布 MANO、相机轨迹、原子动作和端到端处理工具。相较专用多视角或动捕数据，其几何信号更多来自重建；相较 OpenEgo 的跨来源规范化、EgoScale 的超大规模野外视频，它强调低成本采集、结构化处理和模型接入的一体化。

在人类视频到机器人学习的接口上，HaWoR 恢复世界坐标的第一视角手运动，EgoInfinity 构建度量化 4D 手—物轨迹并支持重定向，EgoAERO 与 EgoEngine 分别处理接触一致轨迹和机器人化观测—动作生成；Phantom、SPIDER 等则关注视觉迁移或物理约束重定向。Open-AoE 位于数据与工程层：它整合此类后端，以同步 MANO、相机轨迹、有效性掩码和动作边界作为统一输入，而非提出新的核心重建或 IK 算法。

这一定位使其可同时服务于人类视频动作表征预训练、VLA、世界动作模型与交互式世界模型。Being-H0、EgoVLA、VITRA 将人类视频动作表征引入 VLA 预训练；DreamZero、LaWAM 探索世界动作模型；iVideoGPT、Ctrl-World、DreamDojo 探索可控交互环境。Open-AoE 的额外价值是显式保留相机自运动，从而允许模型区分手—物操作与第一视角运动；这也为 RoboTTT 一类长历史策略提供了更适合学习长期时序状态的人类操作序列。

因此，RoboTTT、FoMoVLA、DriftWorld、Instant NuRec 与 Open-AoE 分别对应五种互补能力：长期交互记忆、未来运动线索、候选动作 rollout、可闭环三维环境，以及可规模化的人类操作数据。RoboTTT 最直接的贡献仍是证明超长连续历史能够在实时闭环控制中带来可扩展收益，而不是构建显式未来预测、世界模型或数据采集体系。