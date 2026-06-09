FROM python:3.11-slim
WORKDIR /app
# Install packages into the image layer. The bind-mount overlays /app with the
# host directory (source + artifacts) but does NOT affect site-packages, so
# these installs survive the mount.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
EXPOSE 5050
CMD ["python", "service.py"]
