const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('총력전')
        .setDescription('현재 진행 중인 총력전 정보를 확인합니다.'),

    // 명령어가 실행될 때 수행할 로직
    // async execute(interaction) {
    //     await interaction.reply('키보토스는 평화로운 상태에요!');
    // },

    async execute(interaction) {
        // 크롤링에 시간이 좀 더 걸리므로 넉넉하게 기다림
        await interaction.deferReply();

        let browser = null;

        try {
            // 1. 설정 파일 읽기
            const configPath = path.join(__dirname, '../strategies/config.json');
            const configData = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configData);
            const { bossName, raidUrl, imageUrl } = config;

            // 2. Puppeteer(브라우저) 실행
            browser = await puppeteer.launch({
                headless: "new", // 브라우저 창을 띄우지 않음
                args: ['--no-sandbox', '--disable-setuid-sandbox'] // 리눅스/서버 환경 호환성 옵션
            });

            const page = await browser.newPage();

            // 3. 봇 탐지 회피를 위한 User-Agent 설정
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

            // 4. 페이지 이동 (Cloudflare 체크를 기다리기 위해 네트워크가 조용해질 때까지 대기)
            await page.goto(raidUrl, { waitUntil: 'networkidle2', timeout: 60000 });

            // 5. 본문 내용이 뜰 때까지 명시적으로 기다림 (아카라이브 본문 클래스: .article-content)
            await page.waitForSelector('.article-content', { timeout: 10000 });

            // 6. 페이지의 HTML을 가져옴
            const content = await page.content();
            
            // 7. Cheerio로 HTML 분석 (기존 로직과 동일)
            const $ = cheerio.load(content);
            
            let tormentLinks = [];
            let insaneLinks = [];
            let extremeLinks = [];

            $('.article-content a').each((index, element) => {
                const text = $(element).text().trim();
                let link = $(element).attr('href');

                if (link && link.startsWith('/')) {
                    link = `https://arca.live${link}`;
                }

                if (!link || !text) return;

                if (text.includes('토먼트') || text.includes('Torment')) {
                    tormentLinks.push(`[${text}](${link})`);
                } else if (text.includes('인세인') || text.includes('Insane')) {
                    insaneLinks.push(`[${text}](${link})`);
                } else if (text.includes('익스트림') || text.includes('Extreme') || text.includes('익스')) {
                    extremeLinks.push(`[${text}](${link})`);
                }
            });

            // 8. 임베드 생성
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`📌 공략: ${bossName}`)
                .setURL(raidUrl)
                .setThumbnail(imageUrl)
                .setDescription(`[원본 공략글 바로가기](${raidUrl})`)
                .addFields(
                    { name: '👿 Torment', value: tormentLinks.length > 0 ? tormentLinks.join('\n') : '링크 없음', inline: false },
                    { name: '👹 Insane', value: insaneLinks.length > 0 ? insaneLinks.join('\n') : '링크 없음', inline: false },
                    { name: '💀 Extreme', value: extremeLinks.length > 0 ? extremeLinks.join('\n') : '링크 없음', inline: false }
                )
                .setFooter({ text: 'Puppeteer로 가져옴' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ **오류 발생:** 아카라이브 접속이 차단되었거나 타임아웃 되었습니다.\n잠시 후 다시 시도하거나 URL을 확인해주세요.');
        } finally {
            // 브라우저 종료 (중요: 메모리 누수 방지)
            if (browser) await browser.close();
        }
    },
};

