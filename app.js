const REQUIRED_SONG_FILES = {
    base_cover: "base.jpg",
    base_audio: "base.ogg",
    song_config: "slst.txt",
    song_config_fallback: "songlist.txt"
};
const SONG_FILE_CONFIG = {
    required: [
        "base.jpg",
        "base.ogg",
        "slst.txt"
    ],
    optional: [
        "songlist.txt"
    ]
};
const SUPABASE_URL = 'https://hwlzunfsvcjxtjdeiuns.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3bHp1bmZzdmNqeHRqZGVpdW5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwOTg3MzMsImV4cCI6MjA3NjY3NDczM30.44XtqidKR61vv9znx2LW6oGGZAP-javBk5Gpweli5T8';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const DIFF_MAPPING = { 0: "Past", 1: "Present", 2: "Future", 3: "Beyond", 4: "Eternal" };
let currentSongTitle = "ARC_Song";
let songlistJson = {};
let isBatchProcessing = false;
let totalBatchFiles = 0;
let completedBatchFiles = 0;
let manualIllustrator = "";
let manualCharter = "";
let currentProcessingFile = null;
let currentProcessingFiles = null;
let isManualMode = false;
let failedCount = 0;
let manualBpm = 120;

document.addEventListener('DOMContentLoaded', function () {
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    setupEventListeners();
    updateConversionStats();
});

function updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-CN');
    const timeElement = document.getElementById('currentTime');
    if (timeElement) {
        timeElement.textContent = `[${timeString}]`;
    }
}

function setupEventListeners() {
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    const continueBtn = document.getElementById('continueBtn');

    fileInput.addEventListener('change', function (e) {
        if (e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files);
            startBatchProcessing(selectedFiles);
        }
    });

    uploadArea.addEventListener('dragover', function (e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', function (e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', function (e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            const zipFiles = Array.from(e.dataTransfer.files).filter(file => file.name.endsWith('.zip'));
            if (zipFiles.length === 0) {
                addLog('error', '请上传ZIP格式的文件');
                return;
            }
            startBatchProcessing(zipFiles);
        }
    });

    continueBtn.addEventListener('click', function() {
        const illustrator = document.getElementById('illustratorInput').value.trim();
        const charter = document.getElementById('charterInput').value.trim();
        const bpm = parseInt(document.getElementById('bpmInput').value) || 120;
        
        manualIllustrator = illustrator;
        manualCharter = charter;
        manualBpm = bpm;
        isManualMode = true;
        
        document.getElementById('inputSection').classList.add('hidden');
        addLog('info', `已设置手动信息 - 曲师: ${illustrator}, 谱师: ${charter}，BPM: ${bpm}`);
        
        continueProcessing();
    });
}

function startBatchProcessing(files) {
    isBatchProcessing = true;
    totalBatchFiles = files.length;
    completedBatchFiles = 0;
    failedCount = 0;
    currentProcessingFiles = files;
    addLog('info', `=== 开始批量处理，共 ${totalBatchFiles} 个ZIP文件 ===`);
    document.getElementById('progressSection').classList.remove('hidden');
    updateProgress(0, `等待处理（0/${totalBatchFiles}）`);
    processNextFile(files);
}

function processNextFile(files) {
    if (completedBatchFiles + failedCount >= files.length) {
        isBatchProcessing = false;
        const successCount = totalBatchFiles - failedCount;
        addLog('success', `\n=== 批量处理结束！共处理 ${totalBatchFiles} 个文件，成功 ${successCount} 个，失败 ${failedCount} 个 ===`);
        return;
    }
    const fileIndex = completedBatchFiles + failedCount;
    const file = files[fileIndex];
    currentProcessingFile = file;
    (async () => {
        try {
            addLog('info', `\n--- 开始处理第 ${fileIndex + 1}/${totalBatchFiles} 个文件：${file.name} ---`);
            await processZipFile(file);
            completedBatchFiles++;
            const batchPercent = Math.round(((completedBatchFiles + failedCount) / totalBatchFiles) * 100);
            updateProgress(batchPercent, `已完成 ${completedBatchFiles}/${totalBatchFiles} 个文件`);
        } catch (error) {
            if (error.message === '等待手动输入信息') {
                addLog('info', `第 ${fileIndex + 1}/${totalBatchFiles} 个文件等待手动输入信息`);
                const batchPercent = Math.round(((completedBatchFiles + failedCount) / totalBatchFiles) * 100);
                updateProgress(batchPercent, `等待手动输入（${completedBatchFiles + failedCount}/${totalBatchFiles}）`);
                return;
            }
            failedCount++;
            const batchPercent = Math.round(((completedBatchFiles + failedCount) / totalBatchFiles) * 100);
            updateProgress(batchPercent, `处理失败（${completedBatchFiles + failedCount}/${totalBatchFiles}）`);
            addLog('error', `第 ${completedBatchFiles + failedCount}/${totalBatchFiles} 个文件处理失败：${error.message}`);
        }
        processNextFile(files);
    })();
}

function addLog(type, message) {
    const logsContainer = document.getElementById('logsContainer');
    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-CN');
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.innerHTML = `
        <span class="log-time">[${timeString}]</span>
        <span class="log-message">${message}</span>
    `;
    logsContainer.appendChild(logEntry);
    logsContainer.scrollTop = logsContainer.scrollHeight;
    console.log(`[${type.toUpperCase()}] ${message}`);
}

function updateProgress(percent, text) {
    const progressText = document.getElementById('progressText');
    const progressBar = document.getElementById('progressBar');
    progressText.textContent = text || `${percent}%`;
    progressBar.value = percent;
    document.getElementById('progressSection').classList.remove('hidden');
}

function showError(message) {
    const errorSection = document.getElementById('errorSection');
    const errorContent = document.getElementById('errorContent');
    errorContent.textContent = message;
    errorSection.classList.remove('hidden');
    if (!isBatchProcessing) {
        document.getElementById('resultSection').classList.add('hidden');
    }
    addLog('error', message);
}

function showSuccess(message, downloadUrl, fileName, fileSize) {
    const resultSection = document.getElementById('resultSection');
    const resultContent = document.getElementById('resultContent');
    const resultHtml = `
        <div style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px dashed #eee;">
            <p>${message}</p>
            <div style="margin-top: 15px;">
                <a href="${downloadUrl}" download="${fileName}" class="download-btn">
                    📥 下载 ${fileName}
                </a>
            </div>
            <p style="margin-top: 15px; color: #7f8c8d;">
                文件大小: ${(fileSize / 1024 / 1024).toFixed(2)}MB
            </p>
        </div>
    `;
    if (isBatchProcessing) {
        resultContent.innerHTML += resultHtml;
    } else {
        resultContent.innerHTML = resultHtml;
    }
    resultSection.classList.remove('hidden');
    document.getElementById('errorSection').classList.add('hidden');
    addLog('success', `打包完成: ${fileName}`);
}

async function unzipSongPackage(zipFile) {
    try {
        const zip = await JSZip.loadAsync(zipFile);
        const files = {};
        let hasFoundFiles = false;
        for (const zipItem of Object.values(zip.files)) {
            if (zipItem.dir) continue;
            if (zipItem.name.includes('__MACOSX')) continue;
            const fileName = zipItem.name.split('/').pop();
            if (fileName) {
                hasFoundFiles = true;
                files[fileName] = await zipItem.async('arraybuffer');
                console.log(`找到文件: ${fileName}（路径：${zipItem.name}）`);
            }
        }
        const { required } = SONG_FILE_CONFIG;
        const missingRequiredFiles = required.filter(file => {
            return file !== 'slst.txt' && !files[file];
        });
        if (missingRequiredFiles.length > 0) {
            throw new Error(`缺少必需的文件: ${missingRequiredFiles.join(', ')}`);
        }
        if (!hasFoundFiles) {
            throw new Error('未找到任何有效的谱面文件');
        }
        return files;
    } catch (error) {
        console.error('解压ZIP文件失败:', error);
        throw error;
    }
}

async function createRootConfigFiles(files, songInfo, userId) {
    updateProgress(isBatchProcessing ? null : 50, "生成配置文件...");
    addLog('info', '开始生成配置文件...');
    const SAMPLE_SONGS = { 'root_song': songInfo };
    const packIds = new Set([songInfo.set || "pack001"]);
    const packlistData = {
        packs: Array.from(packIds).map(pid => ({
            id: pid,
            name_localized: { en: `Pack ${pid}` }
        }))
    };
    files['packlist'] = new TextEncoder().encode(JSON.stringify(packlistData, null, 2));
    addLog('info', `生成packlist: ${Array.from(packIds).join(', ')}`);
    const songlistData = { songs: [] };
    for (const [folderName, songInfoItem] of Object.entries(SAMPLE_SONGS)) {
        const difficultiesArr = Array.isArray(songInfoItem.difficulties) ? songInfoItem.difficulties : [];
        const processedSong = {
            id: songInfoItem.id || folderName,
            title_localized: songInfoItem.title_localized || { en: currentSongTitle },
            artist: songInfoItem.artist || "Unknown Artist",
            side: songInfoItem.side || 0,
            bpm: songInfoItem.bpm || "200",
            bpm_base: songInfoItem.bpm_base || 200.0,
            set: songInfoItem.set || "pack001",
            difficulties: difficultiesArr.map(diff => ({
                chartDesigner: typeof diff === 'object' ? (diff.chartDesigner || songInfoItem.chartDesigner || "Unknown Designer") : songInfoItem.chartDesigner || "Unknown Designer",
                rating: typeof diff === 'object' ? (diff.rating || -1) : -1,
                ratingPlus: typeof diff === 'object' ? (diff.ratingPlus || false) : false,
                ratingClass: typeof diff === 'object' ? diff.ratingClass : diff
            }))
        };
        songlistData.songs.push(processedSong);
    }
    files['songlist'] = new TextEncoder().encode(JSON.stringify(songlistData, null, 2));
    songlistJson = songlistData;
    addLog('success', `生成songlist完成，包含 ${songlistData.songs.length} 首歌曲`);
    return { packlistData, songlistData };
}

async function generateProjectFile(files, songInfo, userId) {
    updateProgress(isBatchProcessing ? null : 70, "生成ARC项目文件...");
    addLog('info', '开始生成ARC项目文件...');
    const song = songlistJson.songs[0];
    const res = { charts: [] };
    let validCharts = 0;
    let difficultiesArr = Array.isArray(song.difficulties) ? song.difficulties : [];
    if (difficultiesArr.length === 0) {
        const affFiles = Object.keys(files).filter(name => name.endsWith('.aff'));
        for (const affFile of affFiles) {
            const numPrefix = affFile.match(/^(\d+)\./);
            if (numPrefix) {
                const ratingClass = parseInt(numPrefix[1]);
                difficultiesArr.push({
                    chartDesigner: userId,
                    rating: -1,
                    ratingPlus: false,
                    ratingClass: ratingClass
                });
                addLog('info', `自动识别谱面文件: ${affFile}，难度等级: ${ratingClass}`);
            } else {
                addLog('warning', `未识别的谱面文件命名: ${affFile}`);
            }
        }
    }
    for (const chart of difficultiesArr) {
        const diff = chart.ratingClass;
        const chartFile = `${diff}.aff`;
        const difficultyName = DIFF_MAPPING[diff] || `未知${diff}`;
        if (!files[chartFile]) {
            addLog('warning', `跳过难度 ${difficultyName}: 缺失文件 ${chartFile}`);
            continue;
        }
        const charterName = manualCharter || chart.chartDesigner || userId;
        const artistName = manualIllustrator || songInfo.artist || "Unknown Artist";
        const diffColors = ['#3A6B78FF', '#566947FF', '#482B54FF', '#7C1C30FF', '#433455FF'];
        const difficultyText = chart.rating !== -1
            ? `${difficultyName} ${chart.rating}${chart.ratingPlus ? '+' : ''}`
            : difficultyName;
        res.charts.push({
            chartPath: chartFile,
            audioPath: "base.ogg",
            jacketPath: "base.jpg",
            baseBpm: song.bpm_base,
            bpmText: song.bpm,
            syncBaseBpm: true,
            title: song.title_localized.en,
            composer: artistName,
            charter: charterName,
            difficulty: difficultyText,
            difficultyColor: diffColors[diff] || '#000000FF',
            skin: { side: ['light', 'conflict', 'colorless'][song.side] },
            previewEnd: song.audioPreviewEnd || 50400
        });
        validCharts++;
        addLog('info', `添加难度: ${difficultyText} (谱师: ${charterName})`);
    }
    if (res.charts.length > 0) {
        const yamlData = jsyaml.dump(res, { encoding: "utf-8" });
        files['project.arcproj'] = new TextEncoder().encode(yamlData);
        addLog('success', `生成project.arcproj，包含 ${validCharts} 个有效难度`);
    } else {
        throw new Error('未生成project.arcproj：无有效难度');
    }
}

async function createARCpkg(files, userId) {
    updateProgress(isBatchProcessing ? null : 90, "创建ARCpkg包...");
    addLog('info', '开始创建ARCpkg包...');
    const zip = new JSZip();
    const packId = "base";
    const songId = songlistJson.songs[0]?.id || "song_" + Date.now();
    addLog('info', `歌曲ID: ${songId}`);
    const songDir = zip.folder(songId);
    const requiredSongFiles = [
        "base.jpg", "base.ogg", "project.arcproj"
    ];
    const affFiles = Object.keys(files).filter(name => name.endsWith('.aff'));
    requiredSongFiles.push(...affFiles);
    let copiedFiles = 0;
    for (const file of requiredSongFiles) {
        if (files[file]) {
            songDir.file(file, files[file]);
            copiedFiles++;
            addLog('debug', `复制文件到歌曲目录: ${file}`);
        } else if (file.endsWith('.aff')) {
            addLog('debug', `跳过缺失的谱面文件: ${file}`);
        } else {
            addLog('warning', `缺失文件: ${file}`);
        }
    }
    addLog('info', `复制了 ${copiedFiles} 个文件到歌曲目录`);
    const indexYml = [
        {
            directory: songId,
            identifier: `${userId}.${songId}`,
            settingsFile: "project.arcproj",
            version: 0,
            type: "level"
        }
    ];
    zip.file("index.yml", jsyaml.dump(indexYml));
    addLog('info', '创建索引文件: index.yml');
    addLog('info', '正在压缩文件...');
    const arcpkgBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 9 }
    });
    addLog('success', `ARCpkg创建完成，大小: ${(arcpkgBlob.size / 1024 / 1024).toFixed(2)}MB`);
    return arcpkgBlob;
}

async function processZipFile(file, userId = "default_user") {
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`文件过大（${(file.size / 1024 / 1024).toFixed(2)}MB），最大支持50MB`);
    }
    updateProgress(isBatchProcessing ? null : 5, "读取ZIP文件...");
    const zipBuffer = await readFileAsArrayBuffer(file);
    const rawExtractedFiles = await unzipSongPackage(zipBuffer);
    const extractedFiles = normalizeExtractedFiles(rawExtractedFiles);
    console.log('规范化后的文件列表:', Object.keys(extractedFiles));
    addLog('info', `ZIP文件解析完成，共识别 ${Object.keys(extractedFiles).length} 个有效文件`);
    const songInfo = await getSongInfoFromFiles(extractedFiles);
    await createRootConfigFiles(extractedFiles, songInfo, userId);
    await generateProjectFile(extractedFiles, songInfo, userId);
    const arcpkgBlob = await createARCpkg(extractedFiles, userId);
    const safeTitle = songInfo.title.replace(/[^\w\-]/g, '_');
    const fileName = `${safeTitle}.arcpkg`;
    const downloadUrl = URL.createObjectURL(arcpkgBlob);
    try {
        const { data, error } = await supabase
            .from('times')
            .update({ times: parseInt(document.getElementById('successCount').textContent) + 1})
            .eq('id', 1);
        if (error) {
            console.error('更新次数失败:', error);
        } else {
            console.log('上传次数已更新');
            updateConversionStats();
        }
    } catch (err) {
        console.error('Supabase操作异常:', err);
    }
    showSuccess(
        `歌曲《${songInfo.title}》打包完成`,
        downloadUrl,
        fileName,
        arcpkgBlob.size
    );
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
}

function normalizeExtractedFiles(zipEntries) {
    const normalized = {};
    const IGNORED_FOLDERS = ['__MACOSX/', '.DS_Store'];
    for (const [fullPath, fileData] of Object.entries(zipEntries)) {
        if (IGNORED_FOLDERS.some(prefix => fullPath.startsWith(prefix))) {
            continue;
        }
        const fileName = fullPath.split('/').pop();
        normalized[fileName] = fileData;
    }
    return normalized;
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("文件读取失败"));
        reader.readAsArrayBuffer(file);
    });
}

async function getSongInfoFromFiles(files) {
    updateProgress(isBatchProcessing ? null : 30, "解析歌曲配置...");
    addLog('info', '开始解析歌曲配置...');

    if (isManualMode) {
        addLog('info', '已进入手动模式，使用默认歌曲配置');
        const affFiles = Object.keys(files).filter(name => name.endsWith('.aff'));
        if (affFiles.length === 0) {
            throw new Error("未找到任何 .aff 谱面文件");
        }
        const songInfo = {
            id: `manual_${Date.now()}`,
            title: currentProcessingFile.name.replace(/\.zip$/i, ''),
            artist: manualIllustrator || "未知艺术家",
            bpm: manualBpm,
            bpm_base: manualBpm,
            difficulty: [],
            jacket: 'base.jpg',
            audio: 'base.ogg',
            side: 1,
            bg: "default",
            version: "1.0.0"
        };
        const diffFileMap = {};
        affFiles.forEach(affFile => {
            const numPrefix = affFile.match(/^(\d+)\./);
            if (numPrefix) {
                const ratingClass = parseInt(numPrefix[1]);
                diffFileMap[ratingClass] = affFile;
                addLog('info', `匹配谱面: ${DIFF_MAPPING[ratingClass] || `等级${ratingClass}`} -> ${affFile}`);
            } else {
                addLog('warning', `未识别的谱面文件命名: ${affFile}`);
            }
        });
        for (const [ratingClass, affFile] of Object.entries(diffFileMap)) {
            songInfo.difficulty.push({
                level: parseInt(ratingClass),
                name: DIFF_MAPPING[ratingClass] || `难度${ratingClass}`,
                file: affFile,
                chartDesigner: manualCharter || "未知谱师",
                rating: -1
            });
        }
        if (songInfo.difficulty.length === 0) {
            throw new Error("未匹配到任何有效谱面");
        }
        currentSongTitle = songInfo.title;
        addLog('success', `手动模式歌曲信息生成完成: ${songInfo.title}（${songInfo.difficulty.length}个难度）`);
        return songInfo;
    }

    let songConfigFile = null;
    if (files['slst.txt']) {
        songConfigFile = 'slst.txt';
        addLog('info', `使用歌曲配置文件: ${songConfigFile}`);
    } else if (files['songlist.txt']) {
        songConfigFile = 'songlist.txt';
        addLog('info', `使用备用歌曲配置文件: ${songConfigFile}`);
    } else {
        addLog('warning', '未找到歌曲配置文件，需要手动输入信息');
        showManualInputSection();
        throw new Error('等待手动输入信息');
    }

    const missingFiles = [];
    if (!files['base.jpg']) missingFiles.push('base.jpg');
    if (!files['base.ogg']) missingFiles.push('base.ogg');
    if (missingFiles.length > 0) {
        throw new Error(`缺失基础文件：${missingFiles.join(', ')}`);
    }
    addLog('info', '所有必需文件检查通过');
    try {
        const slstData = files[songConfigFile];
        const slstText = new TextDecoder().decode(slstData);
        const songInfoRaw = JSON.parse(slstText);
        let songData = null;
        if (songInfoRaw.songs && Array.isArray(songInfoRaw.songs) && songInfoRaw.songs.length > 0) {
            songData = songInfoRaw.songs[0];
        } else if (songInfoRaw.id && songInfoRaw.difficulties) {
            songData = songInfoRaw;
        } else {
            throw new Error("配置文件格式错误：未找到有效的歌曲信息（songs数组为空且不是单曲对象）");
        }
        const songInfo = {
            id: songData.id || `unknown_${Date.now()}`,
            title: songData.title_localized?.en || songData.title || "未知歌曲",
            artist: songData.artist || "未知艺术家",
            bpm: songData.bpm_base || parseInt(songData.bpm) || 120,
            difficulty: [],
            jacket: 'base.jpg',
            audio: 'base.ogg',
            side: songData.side || 1,
            bg: songData.bg || "default",
            version: songData.version || "1.0.0"
        };
        const affFiles = Object.keys(files).filter(name => name.endsWith('.aff'));
        if (affFiles.length === 0) {
            throw new Error("未找到任何 .aff 谱面文件");
        }
        const diffFileMap = {};
        affFiles.forEach(affFile => {
            const numPrefix = affFile.match(/^(\d+)\./);
            if (numPrefix) {
                const ratingClass = parseInt(numPrefix[1]);
                diffFileMap[ratingClass] = affFile;
                addLog('info', `匹配谱面: ${DIFF_MAPPING[ratingClass] || `等级${ratingClass}`} -> ${affFile}`);
            } else {
                addLog('warning', `未识别的谱面文件命名: ${affFile}`);
            }
        });
        if (songData.difficulties && Array.isArray(songData.difficulties)) {
            songData.difficulties.forEach(diff => {
                const ratingClass = diff.ratingClass;
                if (diffFileMap[ratingClass]) {
                    songInfo.difficulty.push({
                        level: ratingClass,
                        name: DIFF_MAPPING[ratingClass] || `难度${ratingClass}`,
                        file: diffFileMap[ratingClass],
                        chartDesigner: diff.chartDesigner || "未知",
                        rating: diff.rating || -1
                    });
                }
            });
        }
        if (songInfo.difficulty.length === 0) {
            throw new Error("未匹配到任何有效谱面");
        }
        currentSongTitle = songInfo.title;
        addLog('success', `歌曲信息解析完成: ${songInfo.title}（${songInfo.difficulty.length}个难度）`);
        return songInfo;
    } catch (error) {
        addLog('error', `配置解析失败: ${error.message}`);
        throw error;
    }
}

function showManualInputSection() {
    document.getElementById('inputSection').classList.remove('hidden');
    document.getElementById('progressSection').classList.add('hidden');
    manualIllustrator = "";
    manualCharter = "";
}

function continueProcessing() {
    document.getElementById('progressSection').classList.remove('hidden');
    const userId = window.currentUserId || "default_user";
    if (currentProcessingFile) {
        processZipFile(currentProcessingFile, userId)
            .catch(err => {
                if (err.message !== '等待手动输入信息') {
                    addLog('error', `继续处理失败：${err.message}`);
                }
            });
    } else if (currentProcessingFiles) {
        startBatchProcessing(currentProcessingFiles);
    }
}

async function fetchConversionStats() {
    try {
        const { data, error } = await supabase
            .from('times')
            .select('times')
            .single();
        if (error) {
            console.error('获取统计数据失败:', error);
            return 0;
        }
        return data?.times || 0;
    } catch (err) {
        console.error('获取统计数据时发生错误:', err);
        return 0;
    }
}

async function updateConversionStats() {
    const count = await fetchConversionStats();
    const countElement = document.getElementById('successCount');
    if (countElement) {
        countElement.textContent = count;
    }
}
