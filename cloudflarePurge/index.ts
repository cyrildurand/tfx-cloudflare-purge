import task = require('azure-pipelines-task-lib/task');
import request = require('request');

async function run() {
    try {
        const zoneName: string = task.getInput('zonename', true);
        const userName: string = task.getInput('username', true);
        const apiKey: string = task.getInput('apikey', true);
        const files: string[] = task.getDelimitedInput('files', '\n');
        
        const headers = {
            "X-Auth-Email": userName,
            "X-Auth-Key": apiKey,
            "Content-Type": "application/json"
        };

        request({url: `https://api.cloudflare.com/client/v4/zones?name=${zoneName}&status=active`, headers: headers}, (error, response, body) => {
            if (error)
                task.setResult(task.TaskResult.Failed, error);
            else {
                const json = JSON.parse(body);
                if (!json.success) 
                    apiFail(json);
                else {
                    const json = JSON.parse(body);
                    if (json.result.length === 0) {
                        fail(`Could not find zone ${zoneName}`);
                    } else if (json.result.length > 1) {
                        fail(`Found more than one match for zone ${zoneName}`);
                    } else {
                        const zoneId = json.result[0].id;
                        clearCache(zoneId, headers, getPayload(files));
                    }
                }
            }
        });
    }
    catch (err) {
        fail(err.message);
    }
}

function getPayload(files: string[]) {
    var paths = files.filter(f => !!f);
    if (paths.length) {
        console.log('Will purge the following files:');
        paths.forEach(f => console.log(f));
        return { files: paths };
    } else{   
        console.log("Will purge everything!");
        return { purge_everything: true };
    }
}

function apiFail(json: any) {
    json.errors.forEach((error: any) => console.log(error.message));
    fail(json.errors[0].message);
}

function fail(message: string) {
    task.setResult(task.TaskResult.Failed, message)
}

function clearCache(zoneId: string, headers: any, payload: object) {
    request({method: 'POST', url: `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, headers: headers, body: JSON.stringify(payload) }, (error, _, body) => {
        if (error)
            task.setResult(task.TaskResult.Failed, error);
        else {
            const json = JSON.parse(body);
            if (!json.success) 
                apiFail(json);
            else {
                console.log("Successfully purged cache");
            }
        }
    });
}

run();