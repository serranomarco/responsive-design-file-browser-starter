class DirectoryTreeNode {
    constructor(name, type, lastModifiedTime) {
        this.name = name;
        this.type = type;
        this.lastModifiedTime = lastModifiedTime;
        this.children = [];
    }

    getIconTypeName() {
        if (this.type === 'directory') {
            return this.name;
        }

        // If it's a file, we parse out the `extension`
        // and use that as our file type
        // Extensions are the bit after the file name such as
        // .jpg .png .txt .js .css
        if (this.type === 'file') {
            const dotIndex = this.name.lastIndexOf('.');
            if (dotIndex >= 0) {
                return this.name.substring(dotIndex + 1).toLowerCase();
            }
            return this.name;
        }

        return '';
    }

    find(path) {
        if (path === '') return this;
        if (path.startsWith('/')) {
            path = path.substring(1);
        }

        let slashIndex = path.indexOf('/');
        if (slashIndex === -1) {
            slashIndex = path.length;
        }

        const targetName = path.substring(0, slashIndex);
        const remainingPath = path.substring(slashIndex);

        for (let child of this.children) {
            if (child.name === targetName) {
                return child.find(remainingPath);
            }
        }

    }

    addChild(child) {
        child.parent = this;
        this.children.push(child);
    }

    getFullPath() {
        if (this.name === undefined) {
            return '';
        }

        let parentPath = '';
        if (this.parent !== undefined) {
            parentPath = this.parent.getFullPath();
        }
        return `${parentPath}/${this.name}`;
    }

    clear() {
        this.children = [];
    }
}

function updateVisualTree(element, directoryTreeNode) {

    // Create an unordered list to make a UI for the directoryTreeNode
    const ul = document.createElement('ul');
    ul.classList.add('tree');
    if (directoryTreeNode !== treeNodeRoot) {
        ul.classList.add('tree--nested');
    }
    // Create a list element for every child of the directoryTreeNode
    for (let child of directoryTreeNode.children) {
        updateVisualTreeEntry(ul, child);
    }

    // Update the tree with the newly created unordered list.
    element.appendChild(ul);
}

function updateVisualTreeEntry(treeElement, child) {
    const li = document.createElement('li');
    li.classList.add('tree-entry');
    li.dataset.pathName = child.getFullPath();
    li.dataset.typeName = child.getIconTypeName();

    // Create a list element with a file icon
    if (child.type === 'file') {
        li.innerHTML = `
        <div class="tree-entry__disclosure tree-entry__disclosure--disabled"></div>
        <img class="tree-entry__icon" src="/icons/file_type_${child.getIconTypeName()}.svg">
        <div class="tree-entry__name file">${child.name}</div>
        <div class="tree-entry__time">${child.lastModifiedTime}</div>
      `;

        // Or create a list element with a folder icon
    } else if (child.type === 'directory') {
        li.innerHTML = `
        <div class="tree-entry__disclosure tree-entry__disclosure--closed"></div>
        <img class="tree-entry__icon" src="/icons/folder_type_${child.getIconTypeName()}.svg">
        <div class="tree-entry__name directory">${child.name}</div>
        <div class="tree-entry__time">${child.lastModifiedTime}</div>
      `;
    }

    // Add the newly created list element into the unordered list
    treeElement.appendChild(li);
}
const treeNodeRoot = new DirectoryTreeNode();
window.addEventListener("DOMContentLoaded", event => {
    const overlay = document.querySelector('.overlay');
    const section = document.getElementById('tree-section');
    const button = document.getElementById('button');
    let fileMoving = [];
    let isMoving = false;

    fetch("/api/path/")
        .then(res => {
            if (!res.ok) {
                throw new Error;
            }
            overlay.classList.add('overlay--hidden');
            return res.json();
        })
        .then(json => {
            json.forEach(element => {
                const { name, type, lastModifiedTime } = element;
                const treeNode = new DirectoryTreeNode(name, type, lastModifiedTime);
                treeNodeRoot.addChild(treeNode);
            });

            updateVisualTree(section, treeNodeRoot)
        })
        .catch(e => {
            console.error(e);
            overlay.classList.add('overlay--error');
        });

    button.addEventListener('click', event => {
        isMoving = true;
        button.disabled = true;
    })

    section.addEventListener('click', async event => {
        const { target } = event;
        const treeEntryElement = target.parentElement;
        const typeName = treeEntryElement.dataset.typeName;
        const directoryName = treeEntryElement.dataset.pathName;

        if (isMoving) {
            if (target.classList.contains('file') || target.classList.contains('directory')) {
                if (fileMoving.length === 0) {
                    return fileMoving.push(directoryName);
                }
            }
            if (!target.classList.contains('file')) {
                const res = await fetch(`/api/entry${fileMoving[0]}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ destination: directoryName })
                });
                if (res.ok) {
                    location.reload();
                }

            }
            button.disabled = false;
            isMoving = false;
            fileMoving = [];
        }

        if (target.classList.contains('tree-entry__disclosure--closed')) {
            target.classList.remove('tree-entry__disclosure--closed')
            target.classList.add('tree-entry__disclosure--opened')

            const res = await fetch(`/api/path${directoryName}`);
            if (res.ok) {
                const json = await res.json();
                const parent = treeNodeRoot.find(directoryName);
                // console.log(parent);
                target.nextElementSibling.src = `/icons/folder_type_${parent.getIconTypeName()}_opened.svg`;
                for (let entry of json) {
                    const { name, type, lastModifiedTime } = entry;
                    const treeNode = new DirectoryTreeNode(name, type, lastModifiedTime);
                    parent.addChild(treeNode);
                }

                updateVisualTree(target.parentElement, parent);

            }
        } else if (target.classList.contains('tree-entry__disclosure--opened')) {
            target.classList.remove('tree-entry__disclosure--opened')
            target.classList.add('tree-entry__disclosure--closed');
            const parent = treeNodeRoot.find(directoryName);
            parent.clear();
            target.parentElement.querySelector('.tree').remove();
        } else if (target.classList.contains("file")) {
            const textbox = document.querySelector('.text-box');
            const res = await fetch(`/api/file${directoryName}`)
            if (res.ok) {
                const text = await res.text();
                textbox.innerHTML = `<pre>${text}</pre>`;
                textbox.classList.add('text-box--show');
            }
        }


    });

    document.querySelector('.text-box').addEventListener('click', event => {
        document.querySelector('.text-box').classList.remove('text-box--show');
    })

});
