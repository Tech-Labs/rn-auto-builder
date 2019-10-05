import { spawn } from 'child_process';
import fetch from 'node-fetch';
import fs from 'fs';
import * as fscp from 'fs-extra';
import rimraf from 'rimraf';

export default class Builder {

    constructor() {
        this.isRun = 0;
        this.taskRunning = 0;
        this.baseURL = 'http://localhost/nashra/data/';
        this.runTask();
        setInterval(() => {
            this.runTask()
        }, 7000);
    }

    async runTask() {
        if (this.taskRunning === 0) {
            this.taskRunning = 1;
            await this.getNewRequest('api.json');
            await this.getAppStatus();
            this.isRun = 0;
        }
    }
    async getNewRequest(action) {
        const response = await fetch(this.baseURL + action);
        const json = await response.json();
        //Name
        this.appName = await json.appName;
        this.buildID = await json.buildID;
        //files destenation
        this.projectDest = '../' + json.appName;
        this.expo = await json.expo;
    }
    async getAppStatus() {
        // expo login and start
        await spawn('expo login -u ' + this.expo.username + ' -p ' + this.expo.password, {
            shell: true,
            cwd: this.projectDest
        });

        var getStatus = await spawn('expo build:status ', {
            shell: true,
            cwd: this.projectDest
        });
        // Read output from proccess one
        getStatus.stdout.on('data', (data) => {
            if (data.includes('Build in progress')) {
                this.isRun = 1;
            }
        });
        getStatus.on('exit', async data => {
            if (this.isRun == 0) {
                var getLink = await spawn('expo url:apk ', {
                    shell: true,
                    cwd: this.projectDest
                });
                // Read output from proccess one
                getLink.stdout.on('data', async link => {
                    console.log(`${link}`);
                });
            }
            this.taskRunning = 0;
        });
    }
    async deleteTmpDir() {
        // delete project
        await rimraf.sync(this.projectDest);
    }
}
const runner = new Builder();