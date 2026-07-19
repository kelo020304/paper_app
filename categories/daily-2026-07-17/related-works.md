# 每日精选 2026-07-17 — Related Works（增量更新）

## 总览

本组工作共同关注具身智能中的“可控世界表征”。M$^\text{4}$World 扩展驾驶世界模型的多视角、多模态与长时交互能力；S$^2$-VLA 通过语义—空间解耦改善自动驾驶决策；VistaVLA 以语义 3D Gaussian 为机器人操作提供紧凑的三维控制上下文；FlowWAM 将光流提升为连接视频生成、动作预测与条件控制的统一表示。DriftWorld 聚焦世界模型的推理效率，以单次漂移生成替代多步扩散 rollout，服务于高频候选动作筛选；DenseReward 则通过具有物理动态的失败轨迹，学习带历史上下文的逐帧任务进度奖励。

GigaWorld-Policy-0.5 补足了“世界模型如何进入实时策略”的问题：它保留未来动态预测作为训练监督，却使部署时的动作分支无需显式生成未来视频。LifelongVLA 则将关注点延伸至“策略如何在部署后持续演化”：在冻结 VLA 骨干的前提下，通过短期／长期双 LoRA 与特征级扩散回放，缓解连续获取新技能时的遗忘与存储开销。新增的 **Action QFormer** 进一步追问动作学习如何改变继承而来的视觉—语言表征：它不主要改变动作编码或规划形式，而是以指令条件查询接口承接动作监督，限制动作梯度对上游多模态表征的无选择重写。

整体差异不只在模态、规模或生成质量，更在于控制条件、空间接口、动作表示、生成速度，以及训练—部署—持续适应之间的信息路径。

## 世界动作模型：将动作纳入视频生成空间

世界动作模型（WAM）尝试将视频生成先验用于控制与未来预测。DreamZero、Cosmos Policy 以数值动作 token 微调视频模型；UWM 与 CoVAR 在共享潜变量中耦合视频和动作扩散头；Video Prediction Policy、Mimic-Video、Causal World Modeling 则先预测视频，再通过逆动力学或因果模块恢复动作。这些方法表明视频先验能够支撑控制，但动作往往仍以异构 token、独立头或后处理模块存在。

从动作表示看，数值 token 方法保留精确的机器人控制空间，却较难跨平台复用；Latent Action Pretraining、Motus 等从帧间转移学习抽象潜在动作；EnerVerse-AC 的 ray map、BridgeV2W 的具身掩码和 Multi-view Video Diffusion Policy 的动作图像则将条件转写到图像域。

FlowWAM 最接近后一类视觉化条件，但将光流定义为随时间变化的稠密位移场，而非静态的动作区域提示：在策略模式下，光流是待预测的动作表示；在世界模型模式下，它又成为条件输入。因此，同一视觉表征可以同时支持动作解码和动作敏感的未来视频生成。已有工作也将光流、像素运动或点轨迹用于控制，例如 Motion Image Diffusion、FlowVLA、Motus 的辅助运动监督，以及 Flow as the Cross-Domain Manipulation Interface、EC-Flow、FLIP、Future Optical Flow Prediction 等；FlowWAM 的关键差异在于，光流并非仅是中间变量，而被纳入预训练视频生成器可生成、可条件化的原生建模空间，从而形成统一的 world-action interface。

GigaWorld-Policy-0.5 代表另一种更偏“策略化”的统一方式。Pandora、FreeAction、RoboTransfer、Cosmos-Transfer1、GigaWorld-0、Qwen-RobotWorld 与 Aether 主要强调动作条件未来视觉的可控生成，并将其作为数据引擎、模拟器或视觉规划基础。GigaWorld-Policy-0.5 则将未来动态预测直接并入策略学习：视频预测不再主要承担离线数据合成，而是为可部署动作策略提供训练期先验。

这使其与 VideoVLA、Motus、UWM 和 MotuBrain 等联合视频—动作建模路线存在明确区别。后者通常让视频与动作在共享生成框架中共同参与推理；GigaWorld-Policy-0.5 通过因果 mask 限制动作预测读取未来视觉，允许动作成为独立的低延迟分支。换言之，FlowWAM 强调以何种共享视觉运动表示联通“生成”与“动作”，而 GigaWorld-Policy-0.5 强调如何在保留世界模型监督的同时，将部署路径收缩为 action-only 推理。

## 快速视觉世界模型：从高保真 rollout 到高频动作筛选

动作条件世界模型可追溯至 World Models 与 Dreamer：前者在紧凑潜空间中学习环境动态，后者进一步在想象轨迹中优化行为。高保真视觉路线则将未来预测展开为可控视频，UniSim、GAIA-1、Genie 和 NVIDIA Cosmos 面向交互式环境生成；在机器人操作中，IRASim、Ctrl-World、UWM 与 Veo-Robotics 更强调细粒度接触、多视角观测或大规模视觉模拟。这些方法与 DriftWorld 共享“给定动作预测未来观测”的目标，但通常依赖多步扩散采样或自回归生成，因而在需要比较大量候选动作时存在明显的推理成本。

DriftWorld 将重点放在生成范式而非新的规划器：模型在训练中拟合特征空间中的漂移场，推理时以单次前向生成未来视频。其思想与 Progressive Distillation、Consistency Models、Rectified Flow、ADD 以及视频侧的少步扩散和蒸馏工作一脉相承；但它并非简单蒸馏一个多步视觉世界模型，而是借鉴 *Generative Modeling via Drifting* 的吸引—排斥场机制，从头学习单步生成。相较于类别条件图像生成，DriftWorld 还针对动作条件序列预测设计了一条件—一真实未来的正样本构造、逐帧动作对齐、特征空间漂移与运动加权，直接服务于机器人视频的动作跟随和运动区域质量。

GigaWorld-Policy-0.5 与 DriftWorld 都回应了视觉世界模型的时延问题，但优化对象不同。DriftWorld 仍生成未来视频，只是将 rollout 压缩为单次生成，以支持 MPC 或 GPC-RANK 式候选动作重排序；GigaWorld-Policy-0.5 则更进一步避免在测试期显式生成未来视频。它与 Mimic-Video、LingBot-VA、S-VAM、DiT4DiT、LaWAM 同属“训练利用视觉 foresight、部署减少像素级未来依赖”的方向，但其侧重点是以动作中心的因果结构切断未来视觉到动作的推理依赖，并用视觉／动作专家分工、AC-WM+WAM 混合预训练和 AutoResearch 配方搜索压缩 action-only 活跃计算。

因此，两者并非替代关系：DriftWorld 适合仍需可见未来轨迹来评估、排序或解释候选行为的模型预测控制；GigaWorld-Policy-0.5 更适合以世界模型训练信号增强闭环策略、但受限于边缘端时延预算的场景。

## 从预测到闭环：规划、策略与反馈接口

在规划和评估层面，Dreamer 类潜空间规划、MPC 与 GPC-RANK 都依赖在模型中比较候选轨迹；尤其在扩散世界模型中，视频 rollout 往往是决策时的主要计算瓶颈。DriftWorld 沿用 GPC-RANK 进行在线重排序，而非提出新的控制目标或规划算法，其贡献应理解为向规划模块提供快速单步视觉 rollout。除在线筛选外，模型还以模拟得分与真实 IoU、任务成功率的相关性验证离线排序能力，因而也连接了 Veo-Robotics、WorldGym 与 UniSim 等将学习到的模拟器用于策略评估的路线。其局限同样明确：单步生成的速度优势能否延续到更长时域、强接触与分布外任务，仍取决于漂移预测误差是否在 rollout 中累积。

相对地，GigaWorld-Policy-0.5 将世界模型从显式“规划环境”转为策略训练中的预测性表征约束：未来视觉主要在训练中塑造动作分支，而非在每个控制周期生成后再进行搜索。这条路线以较少在线可解释性和显式候选比较，换取更低闭环延迟；它是否能保留长时反事实预测或复杂多阶段规划能力，则取决于训练期视频监督能否充分迁移到 action-only 表征。

DenseReward 补上了上述两类方法共同需要的反馈接口。它不是重构世界模型本身，而是通过合成具有物理动态的失败轨迹，学习带历史上下文的逐帧任务进度奖励。由此，快速 rollout、训练期视觉 foresight 与三维／运动表征都可以连接到更密集的评估信号：前者支持候选轨迹排序，后者支持策略优化与失败恢复。

## 动作监督下的表征接口：从动作编码到受控表征塑形

主流 VLA 通常将预训练视觉—语言能力接到动作预测上。RT-1 以大规模机器人数据训练 Transformer 策略，RT-2 将动作表述为文本 token，OpenVLA 采用离散动作分箱，$\pi_0$ 以流匹配生成连续动作、$\pi_{0.5}$ 则以离散动作 token 扩展预训练。围绕动作本身，FAST、VQ-VLA、LAPA、UniVLA 与 RotVLA 分别从频域 token 化、向量量化、无标注视频潜在动作、任务中心动作空间和连续旋转建模出发，改善动作序列的可表示性、扩展性或跨本体迁移。

Action QFormer 并不以替换这些动作目标为重点。它关心的是：当动作损失反向作用于继承的视觉—语言骨干时，哪些信息被保留、哪些注意力会向短期动作判别线索漂移。其查询模块先融入语言指令，再从视觉特征中选择与当前动作相关的证据；因此，动作监督主要通过这一接口塑造动作表征，而非无差别改写上游多模态特征。相较于“如何更好编码动作”，其贡献在于将“如何隔离并引导动作梯度”明确为 VLA 迁移中的结构性问题。

该设计继承了 Perceiver 的潜变量瓶颈、Flamingo 的视觉重采样器，以及 BLIP-2 Q-Former 与 InstructBLIP 的查询式跨模态连接思路，但用途不同：这些方法主要解决视觉信息如何进入语言模型或服务通用视觉语言对齐；Action QFormer 的查询则以指令条件化的动作证据选择和表征稳定性为中心。与 VEGA、DynaFLIP、HARP-VLA、LARA、AGRA 等面向空间、动力学、人机交互或动作落地对齐的方法相比，它的相对新意不在于再引入一种环境表征，而在于把动作监督导致的上游重写与注意力漂移作为直接诊断和干预对象。

其导航实验也应放在这一脉络下理解。ViKiNG、GNM、ViNT、NoMaD 侧重视觉／目标条件导航，LM-Nav、NaVid、Uni-NaVid、NavFoM 与 Navigation World Models 则引入基础模型、视频规划或未来观测建模。Action QFormer 不以显式规划、历史视频或世界模型 rollout 为核心；零样本 sim-to-real 闭环导航更像是对多模态表征能否在动作适配后保持稳定、可迁移的压力测试。由此，它与本组世界模型工作形成互补：后者主要塑造“未来如何表示与预测”，Action QFormer 则处理“动作训练如何安全地读取并改造已有表征”。

## 持续 VLA 学习：从一次性策略训练到部署后技能积累

RT-1、RT-2 与 PaLM-E 将视觉、语言和机器人动作建模相连，并强调将大规模视觉语言或语言模型的语义能力迁移至控制；Open X-Embodiment/RT-X、RoboCat、Gato 与 Octo 则推进跨任务、跨机器人或跨具身泛化。CLIPort、VIMA、Perceiver-Actor、SayCan、Code as Policies 与 VoxPoser 代表模块化规划、语言条件操作或端到端控制路线；Diffusion Policy、$\pi_0$、$\pi_{0.5}$ 与 FAST 则侧重连续生成式动作和更高效的动作表征。

这些工作大多假定技能集合在训练阶段已基本给定，重点是离线泛化或在线执行。LifelongVLA 的问题设定不同：机器人在部署后按顺序获得新任务和新技能，既要快速吸收当前经验，也要维持既有操作能力。因此，它并不试图替换通用 VLA 动作骨干，而是为其引入低存储、低干扰的持续适应机制。

通用持续学习通常在三条路径上权衡。EWC 以参数重要性正则化限制遗忘，LwF 通过输出蒸馏保持旧行为，ER 与 Tiny Episodic Memories 依赖历史样本回放；Progressive Networks 和 PackNet 则通过网络扩展或参数隔离减少任务间干扰。在冻结基础模型与参数高效适配的情形下，DualPrompt、CODA-Prompt、MoE-adapters 探索提示、模块或专家路由，而 LoRA、Prefix-Tuning 与 Prompt Tuning 提供了轻量化适配基础。

LifelongVLA 的针对性在于将低秩适配按时间尺度拆分：短期 LoRA 面向当前任务损失迅速更新，长期 LoRA 则通过回放与蒸馏承担旧知识保持，并以样本条件的权重门控连续混合两者。与直接缓存图像轨迹相比，其随机扩散回放采用“缓存前缀、重算后缀”的特征级形式，旨在降低长时程视觉—语言控制中完整经验回放的存储与计算负担。这里的核心并非单独使用 LoRA、蒸馏或回放，而是让快速可塑性与稳定记忆在同一冻结 VLA 上分工。

Action QFormer 与 LifelongVLA 分别处理 VLA 适配的两个层次：前者在单次或阶段性动作训练中控制梯度经由何处塑造多模态表征，后者在任务序列中决定哪些适配参数应快速更新、哪些应长期保留。前者并不等同于抗遗忘机制，后者也不直接解决动作监督下的注意力偏移；但二者共同表明，VLA 的有效扩展不仅取决于更大的数据或更强的动作解码器，也取决于表征接口与参数更新路径是否被结构化约束。

从本组工作看，LifelongVLA 为“世界表征—控制—反馈”的闭环补上了时间维度：DriftWorld 和 GigaWorld-Policy-0.5 分别降低显式 rollout 与 action-only 部署的即时成本，DenseReward 改善过程反馈，而 Action QFormer 与 LifelongVLA 分别关注动作适配时的表征稳定性和跨任务序列中的记忆稳定性。长期真实机器人评测、任务顺序鲁棒性、跨域恢复能力，以及动作学习对预训练多模态知识的侵蚀程度，因而都比单次任务成功率更关键。