"""
OSNet architecture — vendored, not pip-installed.

Why vendored instead of `pip install torchreid`/`boxmot` (IMPLEMENTATION_PLAN.md §1.6/§5.2,
verified): `boxmot` declares `requires_python <3.14,>=3.10`; `torchreid` 0.2.5 is last
classified for Python 3.9. This box's ONLY interpreter is Python 3.14.4, and both fail to
install. Pure torch/torchvision (both already working here) has no such restriction, so this
file is a direct, trimmed copy of the architecture definition instead.

Source: https://github.com/KaiyangZhou/deep-person-reid/blob/master/torchreid/models/osnet.py
        (commit as of 2026-08-17), MIT License, Copyright (c) 2018 Kaiyang Zhou.
Trimmed from the upstream file: kept OSNet/OSBlock/ChannelGate/the conv helper layers and only
the `osnet_x0_25` factory (the plan's chosen variant — see §5.1 for why OSNet over
EfficientNet, and why x0.25 in particular: smallest/fastest variant, ~0.2M params, already
pretrained on MSMT17 at the weights source below). Dropped: osnet_x1_0/x0_75/x0_5/ibn_x1_0
factories and `init_pretrained_weights` (which shelled out to `gdown` against Google Drive
URLs) — this app loads its own local checkpoint file instead (see embedder.py).

Weights: https://huggingface.co/paulosantiago/osnet_x0_25_msmt17/resolve/main/osnet_x0_25_msmt17.pt
         sha256: 6f57607fed9f502b9efed546108132ee715df5a5b6e6932c6269bacb47f59f9
         (downloaded 2026-08-17; a standard torchreid-format state_dict, MSMT17-pretrained,
         1041 identity classes at train time, 512-d embedding — verified by inspecting the
         checkpoint's own tensor shapes: conv1.conv.weight=[16,3,7,7] (channels=[16,64,96,128],
         i.e. exactly osnet_x0_25's channel config), fc.0.weight=[512,128],
         classifier.weight=[1041,512]).
         Not committed — backend/reid/weights/ is gitignored (*.pt is already ignored
         repo-wide); re-download with the URL above if the weights directory is missing.
"""

from __future__ import annotations

import torch
from torch import nn
from torch.nn import functional as F


##########
# Basic layers
##########
class ConvLayer(nn.Module):
    """Convolution layer (conv + bn + relu)."""

    def __init__(self, in_channels, out_channels, kernel_size, stride=1, padding=0, groups=1, IN=False):
        super().__init__()
        self.conv = nn.Conv2d(
            in_channels, out_channels, kernel_size, stride=stride, padding=padding, bias=False, groups=groups,
        )
        self.bn = nn.InstanceNorm2d(out_channels, affine=True) if IN else nn.BatchNorm2d(out_channels)
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x):
        return self.relu(self.bn(self.conv(x)))


class Conv1x1(nn.Module):
    """1x1 convolution + bn + relu."""

    def __init__(self, in_channels, out_channels, stride=1, groups=1):
        super().__init__()
        self.conv = nn.Conv2d(in_channels, out_channels, 1, stride=stride, padding=0, bias=False, groups=groups)
        self.bn = nn.BatchNorm2d(out_channels)
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x):
        return self.relu(self.bn(self.conv(x)))


class Conv1x1Linear(nn.Module):
    """1x1 convolution + bn (w/o non-linearity)."""

    def __init__(self, in_channels, out_channels, stride=1):
        super().__init__()
        self.conv = nn.Conv2d(in_channels, out_channels, 1, stride=stride, padding=0, bias=False)
        self.bn = nn.BatchNorm2d(out_channels)

    def forward(self, x):
        return self.bn(self.conv(x))


class LightConv3x3(nn.Module):
    """Lightweight 3x3 convolution: 1x1 (linear) + depthwise 3x3 (nonlinear)."""

    def __init__(self, in_channels, out_channels):
        super().__init__()
        self.conv1 = nn.Conv2d(in_channels, out_channels, 1, stride=1, padding=0, bias=False)
        self.conv2 = nn.Conv2d(
            out_channels, out_channels, 3, stride=1, padding=1, bias=False, groups=out_channels,
        )
        self.bn = nn.BatchNorm2d(out_channels)
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x):
        x = self.conv1(x)
        x = self.conv2(x)
        x = self.bn(x)
        return self.relu(x)


##########
# Building blocks for omni-scale feature learning
##########
class ChannelGate(nn.Module):
    """A mini-network that generates channel-wise gates conditioned on the input tensor."""

    def __init__(self, in_channels, num_gates=None, return_gates=False, gate_activation="sigmoid", reduction=16):
        super().__init__()
        num_gates = num_gates or in_channels
        self.return_gates = return_gates
        self.global_avgpool = nn.AdaptiveAvgPool2d(1)
        self.fc1 = nn.Conv2d(in_channels, in_channels // reduction, kernel_size=1, bias=True, padding=0)
        self.relu = nn.ReLU(inplace=True)
        self.fc2 = nn.Conv2d(in_channels // reduction, num_gates, kernel_size=1, bias=True, padding=0)
        if gate_activation == "sigmoid":
            self.gate_activation = nn.Sigmoid()
        elif gate_activation == "relu":
            self.gate_activation = nn.ReLU(inplace=True)
        else:
            self.gate_activation = None

    def forward(self, x):
        inp = x
        x = self.global_avgpool(x)
        x = self.relu(self.fc1(x))
        x = self.fc2(x)
        if self.gate_activation is not None:
            x = self.gate_activation(x)
        return x if self.return_gates else inp * x


class OSBlock(nn.Module):
    """Omni-scale feature learning block: parallel multi-receptive-field branches
    (1, 2, 3, 4 stacked lightweight 3x3 convs) fused by a learned channel gate."""

    def __init__(self, in_channels, out_channels, IN=False, bottleneck_reduction=4, **kwargs):
        super().__init__()
        mid_channels = out_channels // bottleneck_reduction
        self.conv1 = Conv1x1(in_channels, mid_channels)
        self.conv2a = LightConv3x3(mid_channels, mid_channels)
        self.conv2b = nn.Sequential(LightConv3x3(mid_channels, mid_channels), LightConv3x3(mid_channels, mid_channels))
        self.conv2c = nn.Sequential(
            LightConv3x3(mid_channels, mid_channels),
            LightConv3x3(mid_channels, mid_channels),
            LightConv3x3(mid_channels, mid_channels),
        )
        self.conv2d = nn.Sequential(
            LightConv3x3(mid_channels, mid_channels),
            LightConv3x3(mid_channels, mid_channels),
            LightConv3x3(mid_channels, mid_channels),
            LightConv3x3(mid_channels, mid_channels),
        )
        self.gate = ChannelGate(mid_channels)
        self.conv3 = Conv1x1Linear(mid_channels, out_channels)
        self.downsample = Conv1x1Linear(in_channels, out_channels) if in_channels != out_channels else None
        self.IN = nn.InstanceNorm2d(out_channels, affine=True) if IN else None

    def forward(self, x):
        identity = x
        x1 = self.conv1(x)
        x2 = self.gate(self.conv2a(x1)) + self.gate(self.conv2b(x1)) + self.gate(self.conv2c(x1)) + self.gate(self.conv2d(x1))
        x3 = self.conv3(x2)
        if self.downsample is not None:
            identity = self.downsample(identity)
        out = x3 + identity
        if self.IN is not None:
            out = self.IN(out)
        return F.relu(out)


##########
# Network architecture
##########
class OSNet(nn.Module):
    """Omni-Scale Network (Zhou et al., ICCV 2019 / TPAMI 2021).

    In eval mode (the only mode this app uses), `forward()` returns the 512-d
    embedding directly rather than classification logits — see embedder.py.
    """

    def __init__(self, num_classes, blocks, layers, channels, feature_dim=512, loss="softmax", IN=False):
        super().__init__()
        assert len(blocks) == len(layers) == len(channels) - 1
        self.loss = loss
        self.feature_dim = feature_dim

        self.conv1 = ConvLayer(3, channels[0], 7, stride=2, padding=3, IN=IN)
        self.maxpool = nn.MaxPool2d(3, stride=2, padding=1)
        self.conv2 = self._make_layer(blocks[0], layers[0], channels[0], channels[1], reduce_spatial_size=True, IN=IN)
        self.conv3 = self._make_layer(blocks[1], layers[1], channels[1], channels[2], reduce_spatial_size=True)
        self.conv4 = self._make_layer(blocks[2], layers[2], channels[2], channels[3], reduce_spatial_size=False)
        self.conv5 = Conv1x1(channels[3], channels[3])
        self.global_avgpool = nn.AdaptiveAvgPool2d(1)
        self.fc = self._construct_fc_layer(self.feature_dim, channels[3])
        self.classifier = nn.Linear(self.feature_dim, num_classes)
        self._init_params()

    def _make_layer(self, block, layer, in_channels, out_channels, reduce_spatial_size, IN=False):
        blocks_ = [block(in_channels, out_channels, IN=IN)]
        blocks_ += [block(out_channels, out_channels, IN=IN) for _ in range(1, layer)]
        if reduce_spatial_size:
            blocks_.append(nn.Sequential(Conv1x1(out_channels, out_channels), nn.AvgPool2d(2, stride=2)))
        return nn.Sequential(*blocks_)

    def _construct_fc_layer(self, fc_dims, input_dim):
        if isinstance(fc_dims, int):
            fc_dims = [fc_dims]
        layers = []
        for dim in fc_dims:
            layers += [nn.Linear(input_dim, dim), nn.BatchNorm1d(dim), nn.ReLU(inplace=True)]
            input_dim = dim
        self.feature_dim = fc_dims[-1]
        return nn.Sequential(*layers)

    def _init_params(self):
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode="fan_out", nonlinearity="relu")
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)
            elif isinstance(m, (nn.BatchNorm2d, nn.BatchNorm1d)):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.Linear):
                nn.init.normal_(m.weight, 0, 0.01)
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)

    def featuremaps(self, x):
        x = self.conv1(x)
        x = self.maxpool(x)
        x = self.conv2(x)
        x = self.conv3(x)
        x = self.conv4(x)
        return self.conv5(x)

    def forward(self, x):
        x = self.featuremaps(x)
        v = self.global_avgpool(x)
        v = v.view(v.size(0), -1)
        if self.fc is not None:
            v = self.fc(v)
        if not self.training:
            return v
        y = self.classifier(v)
        return y


def osnet_x0_25(num_classes: int = 1041) -> OSNet:
    """Very-tiny width variant (~0.2M params) — the plan's chosen variant (§5.1: small,
    purpose-built for person Re-ID, and pretrained MSMT17 weights are readily available)."""
    return OSNet(
        num_classes, blocks=[OSBlock, OSBlock, OSBlock], layers=[2, 2, 2], channels=[16, 64, 96, 128],
    )


def load_osnet_x0_25_msmt17(weights_path: str, device: str | torch.device = "cpu") -> OSNet:
    """Build osnet_x0_25 and load the MSMT17-pretrained checkpoint (see module docstring
    for source/sha256). Returns the model in eval mode — this app never trains it."""
    model = osnet_x0_25(num_classes=1041)
    state_dict = torch.load(weights_path, map_location="cpu", weights_only=True)
    missing, unexpected = model.load_state_dict(state_dict, strict=False)
    if missing or unexpected:
        raise RuntimeError(
            f"OSNet checkpoint at {weights_path} did not load cleanly: "
            f"missing={missing} unexpected={unexpected}. This usually means the file isn't "
            f"the expected osnet_x0_25 MSMT17 checkpoint — re-download from the URL in this "
            f"module's docstring."
        )
    model.to(device)
    model.eval()
    return model
