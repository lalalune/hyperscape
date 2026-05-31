FROM nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04

ARG DEBIAN_FRONTEND=noninteractive
ARG PIXAL3D_REPO=https://github.com/TencentARC/Pixal3D.git
ARG PIXAL3D_REF=28efad66fdcbd8174a8538d9baf71fe34fe4b6d2

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/models/huggingface \
    TORCH_HOME=/models/torch \
    GRADIO_SERVER_NAME=0.0.0.0 \
    GRADIO_SERVER_PORT=7860 \
    GRADIO_SHARE=0 \
    LOW_VRAM=1 \
    ATTN_BACKEND=flash_attn

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        libgl1 \
        libglib2.0-0 \
        patch \
        python3.10 \
        python3.10-dev \
        python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt

RUN git clone "${PIXAL3D_REPO}" pixal3d \
    && cd pixal3d \
    && git checkout "${PIXAL3D_REF}"

COPY patches/0001-bind-gradio-server.patch /tmp/0001-bind-gradio-server.patch
RUN cd /opt/pixal3d \
    && patch -p1 < /tmp/0001-bind-gradio-server.patch \
    && rm /tmp/0001-bind-gradio-server.patch

WORKDIR /opt/pixal3d

RUN python3.10 -m pip install --no-cache-dir --upgrade pip setuptools wheel \
    && python3.10 -m pip install --no-cache-dir -r requirements-hfdemo.txt

RUN mkdir -p /models/huggingface /models/torch tmp

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5 \
    CMD curl -fsS "http://localhost:${GRADIO_SERVER_PORT}/gradio_api/info" | grep -q 'generate_3d'

CMD ["python3.10", "app.py", "--low_vram"]
