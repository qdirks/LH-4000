(function() {
    console.clear();
    const mw_parser_output = document.querySelector("#mw-content-text .mw-parser-output");

    // split the children into sections
    /** @type {HTMLElement[][]} */
    let sections = [].slice.call(mw_parser_output.children).reduce((pv, cv)=>{
        // every major section starts with an h2
        if (cv.nodeName === 'H2') return pv.push([cv]), pv;
        else return pv[pv.length - 1].push(cv), pv;
    }, [[]]);

    class LabeledSection {
        /**
         * @param {string} label 
         * @param {HTMLTableElement[]} tables 
         */
        constructor(label='', tables=[]) {
            this.label = label;
            this.tables = tables;
        }
    }

    // get the section label and tables for that section
    /** @type {LabeledSection[]} */
    const labeledSections = sections.reduce((pv, cv)=>{
        let label = false;
        let tables = [];
        cv.forEach(node=>{
            if (node.nodeName === 'H3') return label = true;
            if (!label || node.nodeName !== 'TABLE') return;
            tables.push(node);
            label = false;
        });
        label = cv[0].children[0].textContent;
        pv.push(new LabeledSection(label, tables));
        return pv;
    }, []);

    // get all sections on or after Desktop GPUs
    let desktopGPUIndex = labeledSections.findIndex(section=>section.label.startsWith("Desktop GPUs"));
    if (desktopGPUIndex === -1) throw Error("Couldn't find Desktop GPUs section index");
    const gpuSections = labeledSections.slice(desktopGPUIndex);

    // reduce the sections to just the tables that I'm collecting data from
    /** @type {HTMLTableElement[]} */
    const tables = gpuSections.reduce(
        (arr, labeledSection)=>(labeledSection.tables.forEach(table=>arr.push(table)), arr),
        []
    );

    console.log("Number of tables:", tables.length);

    class GPU {
        constructor(model='', launch='', row=null) {
            this.model = model;
            this.launch = launch;
            this.row = row;
        }
    }

    /** @type {GPU[]} */
    const gpuList = tables.slice().reduce((pv, table, ix)=>{
        // console.log("table index:", ix); debugger;
        table = normalizeTable(table);
        const body = table.querySelector('tbody');

        let headerParent = table.querySelector('thead');
        if (!headerParent) headerParent = table.querySelector('tbody');

        const headerRow = headerParent.children[1];
        if (!headerRow) return pv;

        /** @type {HTMLTableCellElement[]} */
        let headers = [].slice.call(headerRow.children);

        let indexOfModel = headers.findIndex(td=>td.textContent.startsWith("Model"));
        // if there isn't a model column, then this isn't the type of table that we're looking for
        if (indexOfModel === -1) return pv;
        
        let indexOfLaunch = headers.findIndex(findLaunch);

        const rows = [].slice.call(body.children).filter(dataRowsOnly);

        // right now, I think I can check if a row contains data by checking for the presence of a td element in the last child position.
        rows.forEach(row=>pv.push(new GPU(
            walkTree(row.children[indexOfModel]).trim().replace(/\s+/g, ' '),
            indexOfLaunch > -1 ? walkTree(row.children[indexOfLaunch]).trim().replace(/\s+/g, ' ') : '',
            row
        )));

        return pv;
    }, []);

    window.gpuList = gpuList;
    console.log("Matched these GPUs with date information:", gpuList.filter(gpu=>gpu.launch));
    console.log("Following GPUs had no launch date:", gpuList.filter(gpu=>!gpu.launch));

    /** @param {HTMLTableElement} table */
    function normalizeTable(table) {
        // the first row sets the number of cells wide
        const width = [].slice.call(table.querySelector("tr").children).reduce((pv, th)=>{
            if (th.colSpan) return pv += th.colSpan;
            else return pv += 1;
        }, 0);

        // get the rows of the table, without getting the rows of sub tables which has been a source of bugs
        let thead = table.querySelector("thead");
        let tbody = table.querySelector("tbody");
        let tfoot = table.querySelector("tfoot");
        /** @type {HTMLTableRowElement[]} */
        let headRows = thead ? [].slice.call(thead.children) : [];
        /** @type {HTMLTableRowElement[]} */
        let bodyRows = tbody ? [].slice.call(tbody.children) : [];
        /** @type {HTMLTableRowElement[]} */
        let footRows = tfoot ? [].slice.call(tfoot.children) : [];
        /** @type {HTMLTableRowElement[]} */
        let rows = headRows.concat(bodyRows).concat(footRows);

        // make sure column spans are taken out
        /** @type {HTMLTableCellElement[]} */
        rows.forEach(row=>{
            /** @type {HTMLTableCellElement[]} */
            const tds = [].slice.call(row.children);
            tds.forEach(td=>{
                if (td.colSpan && td.colSpan > 1) {
                    const colSpan = td.colSpan;
                    td.removeAttribute('colspan');
                    for (let ix = 1; ix < colSpan; ix++) {
                        let td_ = td.cloneNode(true);
                        td.insertAdjacentElement("afterend", td_);
                        td = td_;
                    }
                }
            });
        })

        // replace td row spans with actual td elements in the actual row that they belong to.
        for (let tdIndex = 0; tdIndex < width; tdIndex++) {
            for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
                let rowOuter = rows[rowIndex];
                /** @type {HTMLTableCellElement} */
                let td = rowOuter.children[tdIndex];
                if (!td) continue;
                if (td.rowSpan === 1) continue;
                let rowSpan = td.rowSpan;
                td.removeAttribute('rowSpan');
                for (let offset = 1; offset < rowSpan; offset++) {
                    let rowOffset = rows[rowIndex + offset];
                    /** @type {HTMLTableCellElement} */
                    let clone = td.cloneNode(true);
                    clone.style.backgroundColor = "#f4b8ff";
                    if (tdIndex === 0) rowOffset.prepend(clone);
                    else rowOffset.children[tdIndex - 1].insertAdjacentElement("afterend", clone);
                }
                rowIndex = rowIndex + rowSpan - 1;
            }
        }

        return table;
    }
    /** @param {HTMLElement} node */
    function walkTree(node) {
        let acc = '';
        if (node.nodeName === 'BR') return ' ';
        else if (node.nodeType === Node.TEXT_NODE) acc = node.textContent;
        else for (var ix = 0; ix < node.childNodes.length; ix++) {
            let node_ = node.childNodes[ix];
            if (node_.nodeName === 'SUP') continue;
            acc += walkTree(node_);
        }
        return acc;
    }
    /** @param {HTMLTableRowElement} tr */
    function dataRowsOnly(tr) {
        const row = tr;
        if (row.children[0].classList.contains("table-rh")) return true;
        else if (row.children[0].nodeName === 'TD') return true;
        else if (row.children[row.children.length - 1].nodeName === 'TD') return true;
        else if (row.querySelector('[style="text-align:left;"]')) return true;
        else if (row.querySelector('[style="text-align:left"]')) return true;
        else return false;
    }
    /** @param {HTMLTableCellElement} td*/
    function findLaunch(td) {
        if (td.textContent.toLowerCase().startsWith("release")) return true;
        else if (td.textContent.toLowerCase().startsWith("launch")) return true;
    }
})();
