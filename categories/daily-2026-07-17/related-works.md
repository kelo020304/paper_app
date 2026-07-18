# 每日精选 2026-07-17 — Related Works（增量更新）

## 总览

本组工作共同关注具身智能中的“可控世界表征”。M$^\text{4}$World 扩展驾驶世界模型的多视角、多模态与长时交互能力；S$^2$-VLA 通过语义—空间解耦改善自动驾驶决策；VistaVLA 以语义 3D Gaussian 为机器人操作提供紧凑的三维控制上下文；FlowWAM 将光流提升为连接视频生成、动作预测与条件控制的统一表示。新加入的 DriftWorld 则聚焦世界模型的推理效率：以单次漂移生成替代多步扩散 rollout，使视觉世界模型更适合高频候选动作筛选。DenseReward 补充控制闭环中的奖励接口，通过合成具有物理动态的失败轨迹，学习带历史上下文的逐帧任务进度奖励。

它们的关键区别不在于单纯增加模态或模型规模，而在于分别重构了控制条件、空间接口、动作表示、生成速度或训练反馈。

## 世界动作模型：将动作纳入视频生成空间

世界动作模型（WAM）尝试将视频生成先验用于控制与未来预测。DreamZero、Cosmos Policy 以数值动作 token 微调视频模型；UWM 与 CoVAR 在共享潜变量中耦合视频和动作扩散头；Video Prediction Policy、Mimic-Video、Causal World Modeling 则先预测视频，再通过逆动力学或因果模块恢复动作。这些方法表明视频先验能够支撑控制，但动作往往仍以异构 token、独立头或后处理模块存在。

从动作表示看，数值 token 方法保留精确的机器人控制空间，却较难跨平台复用；Latent Action Pretraining、Motus 等从帧间转移学习抽象潜在动作；EnerVerse-AC 的 ray map、BridgeV2W 的具身掩码和 Multi-view Video Diffusion Policy 的动作图像则将条件转写到图像域。

FlowWAM 最接近第三类，但将光流定义为随时间变化的稠密位移场，而非静态的动作区域提示：在策略模式下，光流是待预测的动作表示；在世界模型模式下，它又成为条件输入。因此，同一视觉表征可以同时支持动作解码和动作敏感的未来视频生成。

已有工作已将光流或像素运动用于控制，如 Motion Image Diffusion、FlowVLA、Motus 的辅助运动监督，Flow as the Cross-Domain Manipulation Interface、EC-Flow、FLIP、Future Optical Flow Prediction 的中间流表示，以及 LangToMo、DAWN、ATM 的像素运动或点轨迹接口。FlowWAM 的差异在于不把流仅作为中间变量，而是将其纳入预训练视频生成器可生成、可条件化的原生建模空间，从而形成统一的 world-action interface。

## 快速视觉世界模型：从高保真 rollout 到高频动作筛选

动作条件世界模型可追溯至 World Models 与 Dreamer：前者在紧凑潜空间中学习环境动态，后者进一步在想象轨迹中优化行为。高保真视觉路线则将未来预测展开为可控视频，UniSim、GAIA-1、Genie 和 NVIDIA Cosmos 面向交互式环境生成；在机器人操作中，IRASim、Ctrl-World、UWM 与 Veo-Robotics 更强调细粒度接触、多视角观测或大规模视觉模拟。这些方法与 DriftWorld 共享“给定动作预测未来观测”的目标，但通常依赖多步扩散采样或自回归生成，因而在需要比较大量候选动作时存在明显的推理成本。

DriftWorld 将重点放在生成范式而非新的规划器：模型在训练中拟合特征空间中的漂移场，推理时以单次前向生成未来视频。其思想与 Progressive Distillation、Consistency Models、Rectified Flow、ADD 以及视频侧的少步扩散和蒸馏工作一脉相承；但它并非简单蒸馏一个多步视觉世界模型，而是借鉴 *Generative Modeling via Drifting* 的吸引—排斥场机制，从头学习单步生成。相较于类别条件图像生成，DriftWorld 进一步针对动作条件序列预测设计了一条件一真实未来的正样本构造、逐帧动作对齐、特征空间漂移与运动加权，这些适配直接服务于机器人视频中的动作跟随和运动区域质量。

这一定位使 DriftWorld 与 FlowWAM 形成互补：FlowWAM 的核心是将光流作为视频与动作共享的表示接口，强调动作如何进入生成模型；DriftWorld 则保留动作条件视频预测的常规接口，优先解决 rollout 如何足够快。前者更适合讨论统一 world-action 表征，后者更适合支撑模型预测控制中的高频候选筛选。

在规划和评估层面，Dreamer 类潜空间规划、MPC 与 GPC-RANK 都依赖在模型中比较候选轨迹；尤其在扩散世界模型中，视频 rollout 往往是决策时的主要计算瓶颈。DriftWorld 沿用 GPC-RANK 进行在线重排序，而非提出新的控制目标或规划算法，其贡献应理解为把快速单步视觉 rollout 提供为规划基础设施。除在线筛选外，模型还以模拟得分与真实 IoU、任务成功率的相关性验证离线排序能力，因而也连接了 Veo-Robotics、WorldGym 与 UniSim 等将学习到的模拟器用于策略评估的路线。其局限同样明确：单步生成的速度优势是否能在更长时域、强接触和分布外任务中保持，仍取决于漂移预测误差是否会在 rollout 中累积。