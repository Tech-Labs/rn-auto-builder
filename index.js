import { spawn } from 'child_process';
import fetch from 'node-fetch';
import fs from 'fs';
import * as fscp from 'fs-extra';
import rimraf from 'rimraf';

export default class Builder {

    constructor() {

        this.builderRunning = 0;
        this.baseURL = 'http://localhost/nashra/data/';
        this.error = 0;
        this.runTask();
        setInterval(() => {
            this.runTask()
        }, 7000);
    }

    async runTask() {
        if (this.builderRunning === 0) {
            this.start = new Date();
            console.log("task strat");
            this.builderRunning = 1;
            // get first queued item
            await this.getNewRequest('api.json');
            // clone project source code
            await this.cloneProject(this.projectDest);
            // Download Logo
            await this.downloadFiles(this.expo.icon, this.iconDest);
            // Download Splash
            await this.downloadFiles(this.expo.splash, this.splashDest);
            // Download AppJson
            await this.downloadFiles(this.expo.appJson, this.appJsonDest);
            // Build Android
            await this.buildApp();

            this.error = 0;
            this.end = new Date();
            this.time = this.end - this.start;
            console.log("excution time " + this.time + "ms");
        }
    }

    async getNewRequest(action) {
        try {
            if (this.error == 0) {
                const response = await fetch(this.baseURL + action);
                const json = await response.json();
                //Name
                this.appName = await json.appName;
                this.buildID = await json.buildID;
                //files destenation
                this.projectDest = '../' + json.appName;
                this.iconDest = '../' + json.appName + '/assets/icon.png';
                this.splashDest = '../' + json.appName + '/assets/splash.png';
                this.appJsonDest = '../' + json.appName + '/app.json';
                this.expo = await json.expo;
            }
        } catch (e) {

            console.log(e);
            this.pushStatus(102, "Get new request fail");
        }
    }

    async cloneProject(destination) {
        try {
            if (this.error == 0) {
                await fscp.copy('../MobileApp', destination);
            }
        } catch (e) {
            console.log(e);
            this.pushStatus(102, "Clone Error");
        }
    }

    async downloadFiles(file, fileDest) {
        try {
            if (this.error == 0) {
                await fetch(file).then(async res => {
                    const dest = await fs.createWriteStream(fileDest);
                    res.body.pipe(dest);
                });
            }
        } catch (e) {
            console.log(e);
            this.pushStatus(102, "download files");
        }
    }

    async pushStatus(code, msg) {
        /*
         * New = 100
         * Proccesing = 101
         * Error = 102
         * ExpoProccesing = 103
         * Finished = 104
         */
        if (code == 102) {
            this.error = 1;
        }
        await fetch(this.baseURL + 'pushStatus', {
            method: 'post',
            body: JSON.stringify({ code, msg, buildID: this.buildID }),
            headers: { 'Content-Type': 'application/json' },
        });
        //await this.deleteTmpDir();
    }
    async deleteTmpDir() {
        // delete project
        await rimraf.sync(this.projectDest);
        // proccess Done
        this.builderRunning = 0;
    }

    /*
     * Build App Function
     * Args object contian [username,password,appDir]
     */
    async buildApp() {
        try {
            if (this.error == 0) {
                // expo login and start
                await spawn(
                    'expo login -u ' + this.expo.username + ' -p ' + this.expo.password + ' & expo start', {
                        shell: true,
                        cwd: this.projectDest
                    }
                );
                var proc = await spawn(
                    'expo start', {
                        shell: true,
                        cwd: this.projectDest
                    }
                );

                // Build App
                var subProc = await spawn('expo', ['build:android', '--no-wait'], {
                    shell: true,
                    cwd: this.projectDest
                });
                // Read output from proccess two
                subProc.stdout.on('data', (datas) => {
                    console.log('here' + datas);
                    // Expo start build our code
                    if (datas.includes('exp build:status')) {
                        // if (datas.includes('Your URL is')) {
                        // kill all proccess after finish
                        proc.kill();
                        subProc.kill();
                        this.pushStatus(103, "Expo Proccesing");
                    }
                });
            }
        } catch (e) {
            this.pushStatus(102, "Clone Error");
        }
    }
}
const runner = new Builder()