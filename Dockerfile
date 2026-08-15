FROM mcr.microsoft.com/playwright:v1.60.0-noble

WORKDIR /app

RUN chown pwuser:pwuser /app

USER pwuser

COPY --chown=pwuser:pwuser package.json package-lock.json ./
RUN npm ci

COPY --chown=pwuser:pwuser . .

ENV CI=true \
    BASE_URL=https://bestprice.com.ua \
    TEST_ENV=prod \
    TEST_PRODUCT_SLUG=otvertka-49108-stal-sl5x75 \
    SITEMAP_LIMIT=25

CMD ["npm", "run", "quality"]
