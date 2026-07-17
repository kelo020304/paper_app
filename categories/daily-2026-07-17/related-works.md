# 每日精选 2026-07-17 — Related Works

## 总览

本组工作共同关注具身智能中的“可控世界表征”：M$^\text{4}$World 扩展驾驶世界模型的多视角、多模态与长时交互能力；S$^2$-VLA 通过语义—空间解耦改善自动驾驶决策；VistaVLA 以语义 3D Gaussian 为机器人操作提供紧凑的三维控制上下文；FlowWAM 则将光流提升为连接视频生成、动作预测与条件控制的统一表示。DenseReward 补充了控制闭环中的奖励接口：通过合成具有物理动态的失败轨迹，学习带历史上下文的逐帧任务进度奖励。

它们的关键区别不在于单纯增加模态或模型规模，而在于分别重构了控制条件、空间接口、动作表示或训练反馈。

## 驾驶世界模型：从场景重建到可控长时生成

重建式驾驶世界模型以 NeRF 和 3D Gaussian Splatting（3DGS）为主线。UC-NeRF、StreetSurf 等将辐射场扩展至道路环境；Street Gaussians、DrivingGaussian、NeuRAD 则利用 Gaussian 表示提升城市场景的渲染效率。EmerNeRF、STORM 通过时空分解处理动态内容，UniSim 与 OmniRe 面向传感器仿真或更通用的重建任务。这类方法擅长复原已观测区域的几何与视图，但通常受日志轨迹、遮挡和采样覆盖限制。

生成式路线则从 GAIA-1、GenAD、Vista 等工作出发，直接根据动作或场景条件预测未来驾驶观测。MagicDrive、Panacea 进一步引入 3D 布局、BEV、天气与轨迹等结构化控制，MagicDriveV2 将这一方向推进至高分辨率、长视频和多视角控制；GAIA-2、Cosmos-Drive-Dreams、OmniDreams、X-World 与 HorizonDrive 也体现了闭环、长时与多相机仿真的趋势。

M$^\text{4}$World 位于生成式而非逐场景重建式范式：它直接生成未观测的未来多视角相机与 LiDAR 观测，并以“3D 框＋类别＋图像描述＋文本描述”控制单一对象。其少样本 LoRA 与视觉参考机制尤其面向长尾对象注入。与近期大规模驾驶生成系统相比，本文的突出点是对象级外观控制和跨模态联合生成；不过其几何保真度未与重建式方法直接比较，且未与多数近期系统进行统一定量评测。

长时、实时生成的技术基础也来自通用视频世界模型。MAGI-1 的分块自回归生成、CausVid 的少步因果蒸馏、Self Forcing 的自生成历史训练，以及 Rolling Forcing、LongLive、Causal Forcing 和 One-Forcing 对长上下文或因果扩散稳定性的改进，共同缓解分块 rollout 的误差累积。M$^\text{4}$World 并未提出独立的通用蒸馏框架，而是组合 Teacher Forcing、ODE 初始化、Self-Forcing、非对称 DMD 与长视频迭代微调，并通过末帧 latent context refresh 以显式视觉锚维持跨块连续性。这使其贡献更接近于将长时因果生成迁移并适配到时变驾驶控制下的多视角、多模态任务。

## 自动驾驶 VLA：语义推理与空间控制的分工

端到端驾驶方法如 TransFuser 直接融合图像与 LiDAR 进行模仿学习；UniAD、VAD 以统一任务或矢量化场景表示衔接感知与规划；PARA-Drive、DRAMA、ARTEMIS 与 DiffusionDrive 则分别从并行执行、序列架构、专家建模或扩散规划改进动作预测。它们通常直接由感知表征导出轨迹，语言语义与精细几何控制之间的职责边界较弱。

另一条路线将 VLM 的语言理解和推理能力引入驾驶。DriveLM、DriveGPT4 和 ReasonPlan 可输出问答、解释或逐步决策过程，但常更接近开环的高层顾问，仍依赖下游控制模块。通用 VLA 工作，如 RT-2、VLA-Adapter、SimLingo、Orion、CoT-VLA、AutoVLA、ReCogDrive 与 ImagiDrive，则探索语言—动作对齐、链式推理、适应性推理、扩散规划或想象增强。

S$^2$-VLA 的核心选择不是增加更多文本推理 token，也不是完全转向生成式规划器，而是显式解耦语义流和空间流：前者建模意图与场景语义，后者保留地图、目标和几何相关的连续控制信息，并以独立路径细化 waypoint。该设计试图避免离散语言 token 成为几何细节的唯一瓶颈。现有实证主要来自 NAVSIM 的纯 SFT 比较，因此其优势应理解为对语义—空间表征分工的结构性验证，而非对所有端到端驾驶范式的普遍结论。

## 机器人 VLA：从二维观测到语义三维控制上下文

RT-1、RT-2、OpenVLA、Octo 与 VLA-Adapter 奠定了由视觉与语言直接映射动作的 VLA 路线，但二维观测对遮挡、视角变化及场景级空间关系的表达有限。为此，3D-VLA、PointVLA、SpatialVLA、3D-CAVLA 和深度增强方法将点云、坐标或深度加入策略；Spatial Forcing、InSpire 等则以空间感知预训练或表征对齐隐式改善空间推理。

VistaVLA 采用不同的接口设计：它将多视角一致的语义特征绑定到 3D Gaussian primitive，并将压缩后的语义 Gaussian token 送入 VLA。相较于把点云或深度作为额外输入，这种做法把语言相关语义与三维位置共同组织为策略可用的场景上下文，同时尽量保留预训练二维 VLM/VLA 的原生特征对齐。

该方法也连接了 3DGS 的语义化与操作化研究。LangSplat、Feature 3DGS 将语言或基础模型特征附着到 Gaussian；GraspSplats、GaussianGrasper、ManiGaussian 与 GWM 则将其用于抓取、操作世界模型或 SLAM。VistaVLA 的定位在于把语义 Gaussian 直接作为动作预测的控制上下文，而非主要服务于新视角渲染、地图构建或单独的抓取模块。

其 MtQ 模块进一步区别于 ToMe、DynamicViT、TokenLearner 等二维 token 压缩，以及 Flamingo、BLIP-2 的查询瓶颈：它先以 Morton 空间分区和语义相似度聚合三维 token，再通过查询解码器形成固定长度摘要。相比 LightGaussian、Compact 3D Gaussian Representation、ContextGS 等偏存储或渲染效率的压缩方法，MtQ 的目标是优先保留操作所需的几何关系、语义关联和多视角一致性。

## 世界动作模型：将动作纳入视频生成空间

世界动作模型（WAM）尝试将视频生成先验用于控制与未来预测。DreamZero、Cosmos Policy 以数值动作 token 微调视频模型；UWM 与 CoVAR 在共享潜变量中耦合视频和动作扩散头；Video Prediction Policy、Mimic-Video、Causal World Modeling 则先预测视频，再通过逆动力学或因果模块恢复动作。这些方法表明视频先验能够支撑控制，但动作往往仍以异构 token、独立头或后处理模块存在。

从动作表示看，数值 token 方法保留精确的机器人控制空间，却较难跨平台复用；Latent Action Pretraining、Motus 等从帧间转移学习抽象潜在动作；EnerVerse-AC 的 ray map、BridgeV2W 的具身掩码和 Multi-view Video Diffusion Policy 的动作图像则将条件转写到图像域。

FlowWAM 最接近第三类，但将光流定义为随时间变化的稠密位移场，而非静态的动作区域提示：在策略模式下，光流是待预测的动作表示；在世界模型模式下，它又成为条件输入。因此，同一视觉表征可以同时支持动作解码和动作敏感的未来视频生成。

已有工作已将光流或像素运动用于控制，如 Motion Image Diffusion、FlowVLA、Motus 的辅助运动监督，Flow as the Cross-Domain Manipulation Interface、EC-Flow、FLIP、Future Optical Flow Prediction 的中间流表示，以及 LangToMo、DAWN、ATM 的像素运动或点轨迹接口。FlowWAM 的差异在于不把流仅作为中间变量，而是将其纳入预训练视频生成器可生成、可条件化的原生建模空间，从而形成统一的 world-action interface。

## 机器人奖励学习：从终局成功判别到失败感知的稠密进度信号

机器人奖励建模的一条主线利用视觉或视觉语言表征，以任务条件化相似度替代手工 reward shaping，例如 Zero-shot Reward Specification、VIP/LIV 与 VLMs as Zero-shot Reward Models。RoboCLIP、RoboReward 则面向更通用的机器人奖励评估；Robometer 进一步通过轨迹比较和次优 rollout 获得更稠密的监督。它们降低了逐任务设计奖励的成本，但许多方法仍主要依赖零样本表征、成功演示的截断，或终局导向的进度代理。

DenseReward 将重点放在“失败过程本身”的可学习性上：奖励模型不是仅判断成功或失败，而是根据当前及历史视觉观测输出逐帧进度标量。其训练数据通过仿真中的阶段感知抓取与规划扰动构造碰撞、漏抓、掉落、退化与恢复等过程，并配合自动有效性过滤。相较于将成功轨迹简单截断或重标注为失败，这一做法更力图保留接触操作中失败发生、恶化和修复的物理动态，因此可为策略提供方向明确的中间反馈。

失败数据的获取也构成关键差异。Roboturk、RoboMind、RoboFAC 等可从人工操作或真实日志中收集失败，但成本和覆盖范围受限；CAST、RACER、ReWiND 等数据增强或反事实构造方法能够扩展样本，却未必产生接触丰富任务中的真实物理后果。DenseReward 的增量不只是扩大负样本，而是将仿真、任务阶段与扰动机制结合，使失败轨迹成为连续奖励监督的来源。其有效性仍依赖仿真物理、扰动分布与真实机器人失败模式之间的匹配程度。

在 VLA 的强化学习适应中，$\pi_0$、OpenVLA 及后续在线 RL 工作表明，PPO 等优化可使策略超越纯模仿学习；DSRL 则在扩散策略潜变量空间中改善真机适应的稳定性。DenseReward 不与这些优化器竞争，而是提供可接入 PPO 和 DSRL 的奖励接口：它把原本稀疏的回合末成功信号补充为过程级反馈。

这一路线也不同于 Visual Foresight、Video Prediction Models as Rewards 和 ViVa 等基于未来观测预测构造价值或奖励的思路。后者将奖励建立在“能否可靠预测未来”之上；DenseReward 直接从当前与历史观测估计任务进度，旨在避开接触、遮挡和突发失败条件下未来视频预测误差对奖励的放大。