const REQUIRED_SONG_FILES = {
    base_cover: "base.jpg",
    base_audio: "base.ogg", 
    song_config: "slst.txt",
    song_config_fallback: "songlist"
};
const SONG_FILE_CONFIG = {
    required: [          // 必须存在的核心文件
        "base.jpg",      // 封面
        "base.ogg",      // 音频
        "slst.txt"       // 主配置文件
    ],
    optional: [          // 备选文件（可选存在）
        "songlist.txt"       // 备用配置文件（仅当slst.txt不存在时才会用到）
    ]
};
const DIFF_MAPPING = { 0: "Past", 1: "Present", 2: "Future", 3: "Beyond", 4: "Eternal" };
let currentSongTitle = "ARC_Song";
let songlistJson = {};
let isBatchProcessing = false;
let totalBatchFiles = 0;
let completedBatchFiles = 0;

document.addEventListener('DOMContentLoaded', function() {
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    setupEventListeners();
});

function updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-CN');
    document.getElementById('currentTime').textContent = `[${timeString}]`;
}

function setupEventListeners() {
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');

    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            const userId = document.getElementById('userId').value || 'Unknown_User';
            const selectedFiles = Array.from(e.target.files);
            startBatchProcessing(selectedFiles, userId);
        }
    });

    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    uploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });
    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        if (e.dataTransfer.files.length > 0) {
            const userId = document.getElementById('userId').value || 'Unknown_User';
            const zipFiles = Array.from(e.dataTransfer.files).filter(file => file.name.endsWith('.zip'));
            if (zipFiles.length === 0) {
                addLog('error', '请上传ZIP格式的文件');
                return;
            }
            startBatchProcessing(zipFiles, userId);
        }
    });

    document.getElementById('userId').addEventListener('input', function(e) {
        if (e.target.value.trim()) {
            addLog('info', `用户ID已更新: ${e.target.value}`);
        }
    });
}

function startBatchProcessing(files, userId) {
    isBatchProcessing = true;
    totalBatchFiles = files.length;
    completedBatchFiles = 0;
    addLog('info', `=== 开始批量处理，共 ${totalBatchFiles} 个ZIP文件 ===`);

    document.getElementById('progressSection').classList.remove('hidden');
    updateProgress(0, `等待处理（0/${totalBatchFiles}）`);

    (async () => {
        for (const file of files) {
            try {
                addLog('info', `\n--- 开始处理第 ${completedBatchFiles + 1}/${totalBatchFiles} 个文件：${file.name} ---`);
                await processZipFile(file, userId);
                completedBatchFiles++;
                const batchPercent = Math.round((completedBatchFiles / totalBatchFiles) * 100);
                updateProgress(batchPercent, `已完成 ${completedBatchFiles}/${totalBatchFiles} 个文件`);
            } catch (error) {
                completedBatchFiles++;
                const batchPercent = Math.round((completedBatchFiles / totalBatchFiles) * 100);
                updateProgress(batchPercent, `处理失败（${completedBatchFiles}/${totalBatchFiles}）`);
                addLog('error', `第 ${completedBatchFiles}/${totalBatchFiles} 个文件处理失败：${error.message}`);
            }
        }

        isBatchProcessing = false;
        const failedCount = totalBatchFiles - completedBatchFiles;
        addLog('success', `\n=== 批量处理结束！共处理 ${totalBatchFiles} 个文件，成功 ${completedBatchFiles - failedCount} 个，失败 ${failedCount} 个 ===`);
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

function clearLogs() {
    const logsContainer = document.getElementById('logsContainer');
    logsContainer.innerHTML = '';
    addLog('info', '日志已清空');
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

// 修复：新增fileSize参数接收Blob实际大小
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

        // 遍历所有文件（不管目录结构，全部提取）
        for (const zipItem of Object.values(zip.files)) {
            if (zipItem.dir) continue;
            if (zipItem.name.includes('__MACOSX')) continue;

            const fileName = zipItem.name.split('/').pop();
            // 只要不是空名就提取
            if (fileName) {
                hasFoundFiles = true;
                files[fileName] = await zipItem.async('arraybuffer');
                console.log(`找到文件: ${fileName}（路径：${zipItem.name}）`);
            }
        }

        // 检查必需文件
        const { required } = SONG_FILE_CONFIG;
        const missingRequiredFiles = required.filter(file => !files[file]);
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
        const processedSong = {
            id: songInfoItem.id || folderName,
            title_localized: songInfoItem.title_localized || { en: currentSongTitle },
            artist: songInfoItem.artist || "Unknown Artist",
            side: songInfoItem.side || 0,
            bpm: songInfoItem.bpm || "200",
            bpm_base: songInfoItem.bpm_base || 200.0,
            set: songInfoItem.set || "pack001",
            difficulties: songInfoItem.difficulties.map(diff => ({
                chartDesigner: typeof diff === 'object' ? (diff.chartDesigner || userId) : userId,
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
    
    for (const chart of song.difficulties) {
        const diff = chart.ratingClass;
        const chartFile = `${diff}.aff`;
        const difficultyName = DIFF_MAPPING[diff] || `未知${diff}`;
        
        if (!files[chartFile]) {
            addLog('warning', `跳过难度 ${difficultyName}: 缺失文件 ${chartFile}`);
            continue;
        }
        
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
            composer: song.artist,
            charter: chart.chartDesigner,
            difficulty: difficultyText,
            difficultyColor: diffColors[diff] || '#000000FF',
            skin: { side: ['light', 'conflict', 'colorless'][song.side] },
            previewEnd: song.audioPreviewEnd || 50400
        });
        validCharts++;
        addLog('info', `添加难度: ${difficultyText}`);
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
    
    // 根据截图，曲包ID应该是"base"，歌曲ID应该是类似"labyrintho..."的名称
    const packId = "base"; // 固定为base，如截图所示
    const songId = songlistJson.songs[0]?.id || "song_" + Date.now();
    
    addLog('info', `曲包ID: ${packId}, 歌曲ID: ${songId}`);
    
    // 1. 创建曲包目录和配置文件（如截图中的base目录）
    const packDir = zip.folder(packId);
    
    // 曲包配置文件（base.yml）
    const packYml = {
        packName: `Pack ${packId}`,
        imagePath: `1080_select_${packId}.png`,
        levelIdentifiers: [`${userId}.${songId}`]
    };
    packDir.file(`${packId}.yml`, jsyaml.dump(packYml));
    addLog('info', `创建曲包配置: ${packId}.yml`);
    
    // 曲包封面（从base.jpg复制并重命名）
    if (files['base.jpg']) {
        packDir.file(`1080_select_${packId}.png`, files['base.jpg']);
        addLog('info', '添加曲包封面: 1080_select_base.png');
    } else {
        addLog('warning', '未找到base.jpg，曲包将使用默认封面');
    }
    
    // 2. 创建歌曲目录（如截图中的labyrintho...目录）
    const songDir = zip.folder(songId);
    
    // 复制所有必要的歌曲文件到歌曲目录
    const requiredSongFiles = [
        "base.jpg", "base.ogg", "slst.txt", "project.arcproj"
    ];
    
    // 添加所有.aff谱面文件
    const affFiles = Object.keys(files).filter(name => name.endsWith('.aff'));
    requiredSongFiles.push(...affFiles);
    
    let copiedFiles = 0;
    for (const file of requiredSongFiles) {
        if (files[file]) {
            songDir.file(file, files[file]);
            copiedFiles++;
            addLog('debug', `复制文件到歌曲目录: ${file}`);
        } else if (file.endsWith('.aff')) {
            // 对于.aff文件，缺失是正常的（不是所有难度都有）
            addLog('debug', `跳过缺失的谱面文件: ${file}`);
        } else {
            addLog('warning', `缺失文件: ${file}`);
        }
    }
    addLog('info', `复制了 ${copiedFiles} 个文件到歌曲目录`);
    
    // 3. 创建根目录的index.yml文件
    const indexYml = [
        {
            directory: packId,
            identifier: `${userId}.${packId}`,
            settingsFile: `${packId}.yml`,
            version: 0,
            type: "pack"
        },
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

async function processZipFile(file, userId) {
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`文件过大（${(file.size / 1024 / 1024).toFixed(2)}MB），最大支持50MB`);
    }

    updateProgress(isBatchProcessing ? null : 5, "读取ZIP文件...");
    const zipBuffer = await readFileAsArrayBuffer(file);
    
    // 解压ZIP文件
    const rawExtractedFiles = await unzipSongPackage(zipBuffer);
    const extractedFiles = normalizeExtractedFiles(rawExtractedFiles);
    
    addLog('info', `ZIP文件解析完成，共识别 ${Object.keys(extractedFiles).length} 个有效文件`);

    // 解析歌曲信息
    const songInfo = await getSongInfoFromFiles(extractedFiles);

    // 生成根配置文件（songlist等）
    await createRootConfigFiles(extractedFiles, songInfo, userId);
    
    // 生成project.arcproj文件
    await generateProjectFile(extractedFiles, songInfo, userId);

    // 创建ARCpkg包
    const arcpkgBlob = await createARCpkg(extractedFiles, userId);

    // 生成下载
    const safeTitle = songInfo.title.replace(/[^\w\-]/g, '_');
    const fileName = `${songId}_${safeTitle}_${userId}.arcpkg`;
    const downloadUrl = URL.createObjectURL(arcpkgBlob);
    
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
    const IGNORED_FOLDERS = ['__MACOSX/', '.DS_Store']; // 忽略macOS系统文件
    
    for (const [fullPath, fileData] of Object.entries(zipEntries)) {
        // 跳过系统文件夹和隐藏文件
        if (IGNORED_FOLDERS.some(prefix => fullPath.startsWith(prefix))) {
            continue;
        }
        
        // 提取文件名（去掉所有父目录路径）
        const fileName = fullPath.split('/').pop();
        // 避免文件名冲突（如果不同目录有同名文件，保留最后一个）
        normalized[fileName] = fileData;
    }
    
    return normalized;
}


// 辅助函数：读取文件为ArrayBuffer
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
    
    let songConfigFile = null;
    if (files['slst.txt']) {
        songConfigFile = 'slst.txt';
        addLog('info', `使用歌曲配置文件: ${songConfigFile}`);
    } else {
        throw new Error(`缺失歌曲配置文件：slst.txt`);
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

        // 兼容原有格式和“单曲对象”格式
        let songData = null;
        if (songInfoRaw.songs && Array.isArray(songInfoRaw.songs) && songInfoRaw.songs.length > 0) {
            songData = songInfoRaw.songs[0];
        } else if (songInfoRaw.id && songInfoRaw.difficulties) {
            // 新格式：直接是单曲对象
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

        // 处理谱面文件
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