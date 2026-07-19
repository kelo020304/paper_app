# 每日精选 2026-07-17 — Related Works（增量更新）

## 总览

本组工作共同关注具身智能中的“可控世界表征”，但其问题已从如何生成未来观测，延伸到如何低时延地执行、稳定地适应，并可信地评估。M$^\text{4}$World、S$^2$-VLA、VistaVLA 与 FlowWAM 分别从多视角多模态、语义—空间解耦、语义三维表示和稠密运动接口扩展世界—动作建模；DriftWorld 与 GigaWorld-Policy-0.5 则分别压缩显式 rollout 和部署期推理路径。DenseReward 为控制过程提供密集反馈，Action QFormer 与 LifelongVLA 分别约束动作训练中的表征改写和长期任务序列中的参数遗忘。

新增的 **Active Real-World Factor-Based Evaluation for Generalist Robot Policies** 补足闭环中的评测层：它不改变策略或世界模型，而是在有限真实机器人预算下，主动选择最有信息量的环境因素组合，以估计通用策略在整个因素空间中的配置级性能分布。由此，本组工作的关键差异不仅在于“如何预测和行动”，也在于“如何以可承受的真实试验成本验证泛化边界”。

## 世界动作模型：将动作纳入视频生成空间

世界动作模型（WAM）尝试将视频生成先验用于控制与未来预测。DreamZero、Cosmos Policy 以数值动作 token 微调视频模型；UWM 与 CoVAR 在共享潜变量中耦合视频和动作扩散头；Video Prediction Policy、Mimic-Video、Causal World Modeling 则先预测视频，再通过逆动力学或因果模块恢复动作。它们表明视频先验能够支撑控制，但动作往往仍以异构 token、独立头或后处理模块存在。

数值 token 方法保留精确的机器人控制空间，却较难跨平台复用；Latent Action Pretraining、Motus 等从帧间转移学习抽象潜在动作；EnerVerse-AC 的 ray map、BridgeV2W 的具身掩码和 Multi-view Video Diffusion Policy 的动作图像则将条件转写到图像域。

FlowWAM 最接近后一类视觉化条件，但将光流定义为随时间变化的稠密位移场，而非静态动作区域提示：在策略模式下，光流是待预测的动作表示；在世界模型模式下，它又成为条件输入。因此，同一视觉表征可以同时支持动作解码和动作敏感的未来视频生成。Motion Image Diffusion、FlowVLA、EC-Flow、FLIP 与 Future Optical Flow Prediction 也使用光流或像素运动服务控制；FlowWAM 的差异在于将光流纳入预训练视频生成器可生成、可条件化的原生空间，形成统一的 world-action interface。

GigaWorld-Policy-0.5 则代表更偏“策略化”的统一方式。Pandora、FreeAction、RoboTransfer、Cosmos-Transfer1、GigaWorld-0、Qwen-RobotWorld 与 Aether 主要强调动作条件未来视觉的可控生成，并将其用于数据引擎、模拟器或视觉规划；GigaWorld-Policy-0.5 将未来动态预测直接并入策略学习。其因果 mask 限制动作预测读取未来视觉，使动作在部署时成为独立低延迟分支。因而，FlowWAM 重点在共享何种视觉运动表示联通生成与动作，GigaWorld-Policy-0.5 则重点在保留世界模型监督的同时，将部署路径收缩为 action-only 推理。

## 快速视觉世界模型：从高保真 rollout 到高频动作筛选

World Models 与 Dreamer 在紧凑潜空间中学习环境动态，并在想象轨迹中优化行为。高保真视觉路线则将未来预测展开为可控视频：UniSim、GAIA-1、Genie 和 NVIDIA Cosmos 面向交互环境生成；IRASim、Ctrl-World、UWM 与 Veo-Robotics 更强调细粒度接触、多视角观测或大规模机器人视觉模拟。这些方法与 DriftWorld 同样解决“给定动作预测未来观测”，但多步扩散或自回归生成会限制候选动作的大规模比较。

DriftWorld 将重点放在生成范式而非新的规划器：训练时拟合特征空间中的漂移场，推理时以单次前向生成未来视频。它与 Progressive Distillation、Consistency Models、Rectified Flow、ADD 及视频少步生成一脉相承，但不是简单蒸馏一个多步世界模型，而是借鉴 *Generative Modeling via Drifting* 的吸引—排斥场机制从头学习单步生成。针对动作条件序列预测，它进一步采用一条件—一真实未来的正样本构造、逐帧动作对齐、特征空间漂移和运动加权，直接优化动作跟随与运动区域质量。

GigaWorld-Policy-0.5 与 DriftWorld 都回应了视觉世界模型的时延问题，但优化对象不同。DriftWorld 仍生成未来视频，以支持 MPC 或 GPC-RANK 式候选动作重排序；GigaWorld-Policy-0.5 则在测试期避免显式生成未来视频。前者保留可视化的反事实轨迹与候选比较，后者以较少在线可解释性换取更低闭环延迟。

## 从预测到闭环：规划、奖励与评测接口

Dreamer 类潜空间规划、MPC 与 GPC-RANK 都依赖模型内的候选轨迹比较；在扩散世界模型中，视频 rollout 常是决策时的主要瓶颈。DriftWorld 沿用 GPC-RANK 在线重排序，其贡献应理解为向规划模块提供快速单步视觉 rollout，而非替代规划目标本身。其模拟得分与真实 IoU、任务成功率的相关性，也使其连接到 Veo-Robotics、WorldGym 与 UniSim 等将学习模拟器用于策略评估的路线。

GigaWorld-Policy-0.5 将世界模型从显式“规划环境”转为策略训练中的预测性表征约束：未来视觉主要在训练中塑造动作分支，而非每个控制周期用于搜索。DenseReward 则补上两者都需要的反馈接口：它以具有物理动态的失败轨迹学习带历史上下文的逐帧任务进度奖励，使快速 rollout、训练期视觉 foresight 和三维／运动表征能够接入更密集的轨迹排序、策略优化与失败恢复信号。

## 真实世界主动评测：从测试套件到预算内的因素空间估计

RT-1、RT-2、OpenVLA 与 $\pi_0$ 代表从大规模行为克隆走向 VLA 与生成式动作策略的路线，其重点通常是多任务能力、视觉泛化和动作生成。**Active Real-World Factor-Based Evaluation for Generalist Robot Policies** 不提出新的策略架构，而是以微调后的 $\pi_0$ 为对象，研究如何在严格有限的真实试验预算下，可信且经济地评估既有通用策略。

LIBERO、CALVIN、Colosseum、VLABench、LIBERO-plus，以及关于泛化缺口分解和通用操作策略评测因素分类的工作，主要规定“测什么”：它们通过任务集、扰动、OOD 条件或因素分类揭示策略的泛化弱点。新增工作假定人类已给出可解释的环境因素空间，进一步解决“先测哪里”：以代理模型和主动采集策略选择最具信息量的真实配置，并输出整个配置空间上的性能分布，而非单一平均成功率。

这一设定与 Active Testing、Active Surrogate Estimators 的样本高效模型评估相近，但机器人策略的动作输出与评测结果不同，代理模型只能从评测试验中学习，不能直接复用策略训练示范。与 *Efficient Evaluation of Multi-Task Robot Policies with Active Experiment Selection* 相比，后者在仿真中面向策略—任务组合进行成本感知选择，并采用 MDN+BALD；本文聚焦单一策略、真实硬件、环境因素组合和严格的 100 次预算，同时系统比较代理模型与采集函数。Contrast Sets 关注因素切换成本，sim-real 混合评测关注不完美模拟器的利用，风险约束早停关注策略间快速比较；新增工作则以固定单策略在完整真实因素空间中的性能估计为中心。

因此，它与本组世界模型工作形成互补：DriftWorld 评估候选动作的预测后果，DenseReward 评价轨迹进度，而主动真实评测评估策略在何种物理与环境条件下可靠。后者尤其能检验 action-only 策略是否真的继承了训练期视觉 foresight 的泛化收益，以及持续学习后的新旧技能是否在真实扰动下仍保持稳定。

## 动作监督下的表征接口：从动作编码到受控表征塑形

主流 VLA 通常将预训练视觉—语言能力接到动作预测上。RT-1 以大规模机器人数据训练 Transformer 策略，RT-2 将动作表述为文本 token，OpenVLA 采用离散动作分箱，$\pi_0$ 以流匹配生成连续动作，$\pi_{0.5}$ 则以离散动作 token 扩展预训练。FAST、VQ-VLA、LAPA、UniVLA 与 RotVLA 分别从频域 token 化、向量量化、潜在动作、任务中心动作空间和连续旋转建模出发，改善动作序列的表示与迁移。

Action QFormer 不以替换这些动作目标为重点。它关注动作损失反向作用于继承的视觉—语言骨干时，哪些信息被保留、哪些注意力会向短期动作判别线索漂移。其查询模块先融入语言指令，再从视觉特征中选择当前动作相关的证据，使动作监督主要塑造接口后的动作表征，而非无差别改写上游多模态特征。

该设计继承 Perceiver 的潜变量瓶颈、Flamingo 的视觉重采样器，以及 BLIP-2 Q-Former 与 InstructBLIP 的查询式跨模态连接思路，但目的不同：前述方法主要解决视觉信息如何服务语言模型和通用对齐；Action QFormer 则以指令条件化的动作证据选择和表征稳定性为中心。其导航实验也更适合作为动作适配后多模态表征能否保持稳定、可迁移的压力测试，而非显式世界模型或视频规划方法。

## 持续 VLA 学习：从一次性策略训练到部署后技能积累

RT-1、RT-2、PaLM-E、Open X-Embodiment/RT-X、RoboCat、Gato 与 Octo 推进跨任务、跨机器人或跨具身泛化；CLIPort、VIMA、Perceiver-Actor、SayCan、Code as Policies 与 VoxPoser 则代表模块化规划、语言条件操作或端到端控制路线。它们大多假定技能集合在训练阶段已基本给定，重点是离线泛化或在线执行。

LifelongVLA 的设定不同：机器人在部署后顺序获得新任务和新技能，既要快速吸收当前经验，也要保持既有操作能力。通用持续学习可沿参数重要性正则化（EWC）、蒸馏保持（LwF）、经验回放（ER）与模块隔离（Progressive Networks、PackNet）等路径权衡稳定性和可塑性；LoRA、Prompt Tuning 与专家路由为冻结基础模型上的轻量适配提供基础。

LifelongVLA 将低秩适配按时间尺度拆分：短期 LoRA 快速响应当前任务，长期 LoRA 通过回放和蒸馏保持旧知识，并以样本条件的权重门控混合两者。其“缓存前缀、重算后缀”的特征级扩散回放，旨在降低长时程视觉—语言控制中完整轨迹回放的存储与计算负担。核心不在单独使用 LoRA、蒸馏或回放，而在于让快速可塑性与稳定记忆在同一冻结 VLA 上明确分工。

Action QFormer 与 LifelongVLA 分别处理 VLA 适配的两个层次：前者约束单次动作训练中梯度经由何处塑造多模态表征，后者决定任务序列中哪些适配参数应快速更新、哪些应长期保留。新增的主动真实评测则提供外部检验：除平均成功率外，还应比较任务顺序、环境因素和真实扰动下的配置级性能分布，才能判断表征稳定性、记忆稳定性和世界模型监督是否真正转化为可靠的机器人泛化。