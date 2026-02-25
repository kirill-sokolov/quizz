FROM node:20-slim

# Install system dependencies for DOCX processing
# LibreOffice: DOCX → PDF
# ImageMagick + Ghostscript: PDF → PNG
RUN apt-get update && apt-get install -y \
    libreoffice \
    imagemagick \
    ghostscript \
    && rm -rf /var/lib/apt/lists/*

# Configure ImageMagick to allow PDF processing
RUN sed -i '/disable ghostscript format types/,+6d' /etc/ImageMagick-6/policy.xml || true

WORKDIR /app

# Note: npm install and app start will be handled by docker-compose command
# This allows for live reload during development

EXPOSE 3000

CMD ["npm", "run", "dev"]
