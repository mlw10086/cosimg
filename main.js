const dropArea = document.getElementById('drop-area');
        const fileElem = document.getElementById('fileElem');
        const thumbContainer = document.getElementById('thumb-container');
        const resultContainer = document.getElementById('result-container');
        const uploadBtn = document.getElementById('upload-btn');
        const clearBtn = document.getElementById('clear-btn');

        let filesToUpload = [];

        uploadBtn.addEventListener('click', () => {
            if (filesToUpload.length === 0) {
                weui.topTips('请选择文件后再上传', 500);
                return;
            }
            uploadFiles();
        });

        clearBtn.addEventListener('click', () => {
            thumbContainer.innerHTML = '';
            resultContainer.innerHTML = '';
            filesToUpload = [];
            weui.toast('已清除', 500);
        });

        dropArea.addEventListener('dragover', (event) => {
            event.preventDefault();
            dropArea.classList.add('dragover');
        });

        dropArea.addEventListener('dragleave', () => {
            dropArea.classList.remove('dragover');
        });

        dropArea.addEventListener('drop', (event) => {
            event.preventDefault();
            dropArea.classList.remove('dragover');
            const files = Array.from(event.dataTransfer.files).filter(file => file.type.startsWith('image/'));
            handleFiles(files);
        });

        dropArea.addEventListener('click', () => {
            fileElem.click();
        });

        fileElem.addEventListener('change', () => {
            handleFiles(Array.from(fileElem.files));
        });

        document.addEventListener('paste', (event) => {
            const items = event.clipboardData.items;
            const files = [];
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    files.push(blob);
                }
            }
            handleFiles(files);
        });

        const MAX_FILE_SIZE = 20 * 1024 * 1024; 

        function handleFiles(files) {
            for (let file of files) {
                if (filesToUpload.length >= 10) {
                    weui.topTips('最多只能上传10张图片', 1000);
                    break;
                }
                if (!file.type.startsWith('image/')) {
                    weui.topTips('只允许上传图片文件', 1000);
                    continue;
                }
                if (file.size > MAX_FILE_SIZE) {
                    weui.topTips(`文件 ${file.name} 超过20MB限制`, 3000);
                    continue;
                }
                const reader = new FileReader();
                reader.onloadend = () => {
                    const img = document.createElement('img');
                    img.src = reader.result;
                    img.classList.add('thumb');
                    thumbContainer.appendChild(img);
                };
                reader.readAsDataURL(file);
                filesToUpload.push(file);
            }
        }

        function uploadFiles() {
            const totalFiles = filesToUpload.length;
            let uploadedFiles = 0;
            
            const loadingTip = weui.loading('文件上传中...');

            const uploadPromises = filesToUpload.map((file, index) => {
                const formData = new FormData();
                formData.append('file', file);

                return fetch('upload.php', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        displayResult(data.url);
                        uploadedFiles++;
                        weui.toast(`已上传 ${uploadedFiles}/${totalFiles}`, 500);
                    } else {
                        weui.topTips(`文件 ${index + 1} 上传失败: ${data.message}`, 500);
                    }
                })
                .catch(error => {
                    weui.topTips(`文件 ${index + 1} 上传失败: ${error.message}`, 500);
                });
            });

            Promise.all(uploadPromises)
                .then(() => {
                    loadingTip.hide();
                    weui.toast('全部上传完成', 500);
                });
        }

        function displayResult(imgUrl) {
            const resultItem = document.createElement('div');
            resultItem.classList.add('weui-cell');

            const cellBody = document.createElement('div');
            cellBody.classList.add('weui-cell__bd');

            const codeTabs = document.createElement('div');
            codeTabs.classList.add('code-tabs');
            ['URL', 'UBB', 'Markdown', 'HTML'].forEach((tabName, index) => {
                const tab = document.createElement('div');
                tab.classList.add('code-tab');
                tab.textContent = tabName;
                tab.addEventListener('click', () => switchTab(resultItem, index));
                codeTabs.appendChild(tab);
            });
            cellBody.appendChild(codeTabs);

            const codeContents = [
                imgUrl,
                `[img]${imgUrl}[/img]`,
                `![image](${imgUrl})`,
                `<img src="${imgUrl}" alt="image">`
            ];

            codeContents.forEach((content, index) => {
                const codeContent = document.createElement('div');
                codeContent.classList.add('code-content');
                const input = document.createElement('input');
                input.type = 'text';
                input.value = content;
                input.readOnly = true;
                input.classList.add('weui-input');
                codeContent.appendChild(input);
                cellBody.appendChild(codeContent);
            });

            const copyButton = document.createElement('a');
            copyButton.classList.add('weui-btn', 'weui-btn_mini', 'weui-btn_primary');
            copyButton.textContent = '复制';
            copyButton.addEventListener('click', () => {
                const activeInput = resultItem.querySelector('.code-content.active input');
                activeInput.select();
                document.execCommand('copy');
                weui.toast('已复制', 500);
            });

            const cellFoot = document.createElement('div');
            cellFoot.classList.add('weui-cell__ft');
            cellFoot.appendChild(copyButton);

            resultItem.appendChild(cellBody);
            resultItem.appendChild(cellFoot);
            resultContainer.appendChild(resultItem);

            switchTab(resultItem, 0);
        }

        function switchTab(resultItem, activeIndex) {
            const tabs = resultItem.querySelectorAll('.code-tab');
            const contents = resultItem.querySelectorAll('.code-content');
            
            tabs.forEach((tab, index) => {
                if (index === activeIndex) {
                    tab.classList.add('active');
                    contents[index].classList.add('active');
                } else {
                    tab.classList.remove('active');
                    contents[index].classList.remove('active');
                }
            });
        }
