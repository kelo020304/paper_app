# 每日精选 2026-07-14 — Related Works

## 总览

端到端自动驾驶正从“感知特征到自车规划”的统一学习，扩展为同时建模语言语义、场景状态、多智能体未来交互，以及支撑这些能力的数据规模与覆盖范围。WCog-VLA代表以视觉语言推理、显式三维状态和联合轨迹预测构建世界认知的路线；OpenLongTail则补齐其上游数据接口，使开放网络或消费级单目前视长尾视频能够被转换为可用于既有多相机驾驶策略训练的资产。

## 端到端规划与生成式驾驶

早期端到端方法如 TransFuser 将多传感器观测直接映射为驾驶决策；UniAD 与 VAD 以统一的稠密 BEV 表示衔接感知、预测和规划，SparseAD则以稀疏查询降低统一架构的计算开销。GenAD、DiffusionDrive、VADv2等进一步将规划转向生成式或概率式轨迹建模，以表达自车未来行为的不确定性和多模态性。

这类工作通常假定训练数据已具备同步、标定的多传感器或多视角记录。OpenLongTail并不提出新的规划或控制器，而是在数据层扩大此类方法的可用训练来源：它从未定姿、异构的单目长尾素材中恢复轨迹，并生成目标相机 rig 的多视角训练资产，再通过 Alpamayo-R1 的闭环微调验证其对策略学习的增益。因此，它与生成式规划的关系更接近“数据供给扩展”，而非改变自车轨迹分布的建模方式。

## VLM/VLA 驾驶与连续动作建模

DriveGPT4、DriveLM等工作最初主要以视觉语言模型承担场景理解、问答与解释；Alpamayo、AutoVLA、OpenDriveVLA、DriveVLA和LMDrive则进一步将视觉、语言推理与端到端规划或控制关联起来。SENNA、EMMA、AlphaDrive、DiffVLA等方法分别引入可解释决策、强化学习或扩散机制，推动VLM从驾驶描述器走向策略模型。

在动作表示上，OmniReason、AdaThinkDrive使用文本推理生成决策，AutoVLA采用自回归动作 token，ORION借助VAE、ReCogDrive借助扩散式规划，以缓解离散语言表征与连续控制之间的鸿沟。WCog-VLA同样以视觉语言模型为高层认知基础，但其 agent token 受到三维感知和未来运动监督，并连接至联合多智能体扩散轨迹生成，使语义推理落到可验证的物理状态与交互未来。

与上述策略建模工作不同，OpenLongTail关注其训练前提：Waymo Open Dataset、nuScenes、Argoverse、BDD100K、nuPlan，以及CODA、Waymo E2E等长尾基准，仍难以把开放网络视频持续接入既有策略接口。其贡献在于将长尾视频转化为与VLA/VLA式策略兼容的多视角驾驶数据，而非以语言模型直接重构控制逻辑。

## 世界认知与多智能体前瞻

围绕VLA的世界认知，DrivePI强调空间感知，SGDrive以scene–agent–goal结构组织驾驶认知，SparseOccVLA等工作则强化占据或空间表示。UniDrive-WM、DriveVLA-W0则通过未来图像生成赋予模型前瞻能力。

WCog-VLA将这些方向结合为“语义预测 + 轨迹生成”的双层设计：高层通过VLM与Game-CoT进行面向交互的推理，低层以联合多智能体轨迹生成刻画物理演化。相较于侧重语义结构、空间表示或感知式未来生成的方法，其核心差异在于显式优化自车与周边智能体的联合运动关系，并以Stackelberg式博弈视角服务规划决策。

## 可控生成、几何恢复与长尾数据扩展

Wan、CogVideoX、SkyReels等视频基础模型提供生成先验；Street、BEVControl、DrivingDiffusion、Cosmos、MagicDrive、Panacea、WoVoGen、Vista、LongDWM、DrivingWorld、DriveGenVLM、InfinityDrive和FAR等则将生成用于驾驶仿真、多视角合成、长时序建模或闭环场景构建。它们中不少依赖3D layout、3D bounding box、LiDAR或occupancy等稠密结构条件，因此对开放网络的弱标注、单目视频并不直接适用。

TrajectoryCrafter、ReCamMaster、Gen3C、Vista4D和NeoVerse等相机或轨迹可控生成方法能够从稀疏观测合成新视角，但车载环视相机之间往往低重叠，侧后区域甚至完全未被前视相机观测。OpenLongTail明确处理这种“正前单目到侧后目标 rig”的外推：以恢复的米制轨迹构造Plücker ray条件，结合前视深度的跨时刻 lookback warp 与拓扑化跨视角记忆，生成未观测区域的多视角内容；并以GeoKPM衡量跨相机几何一致性。

3D Gaussian Splatting及相关神经渲染提供可重渲染场景的另一条路径，但通常依赖充足视角重叠、跨视角光度一致性和准确相机轨迹，在窄视场单目、动态物体与采集伪影下较为脆弱。OpenLongTail不将显式三维重建作为前提，而是以MapAnything的米制轨迹估计及Kalman/RTS平滑作为几何锚点，再由生成模型补全不可重建区域。其轨迹模块的重点也并非取代MapAnything：在保持相近米制ATE的同时，主要通过平滑降低jerk和加速度方差。