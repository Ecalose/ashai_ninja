/* eslint-disable camelcase */
'use strict';
require('dotenv').config();
const {
    addEnv, delEnv, getEnvs, getEnvsCount, updateEnv, disable, enable
} = require('./ql');

module.exports = class User {
    ptKey;
    ptPin;
    eid;
    username;
    ck;

    constructor({
                    ptKey, ptPin, eid, username, ck
                }) {
        this.ptKey = ptKey
        this.ptPin = ptPin
        if (ptKey && ptPin) {
            this.cookie = 'pt_key=' + this.ptKey + ';pt_pin=' + this.ptPin + ';';
        }
        this.eid = Number(eid)
        this.username = username
        this.ck = ck
    }

    async login() {
        const envs = await getEnvs();
        const env = await envs.find(item => item.remarks === this.username);
        if (env) {
            return {
                errCode: 0, username: env.remarks, eid: env.id, timestamp: env.timestamp,
            };
        } else {
            return {
                errCode: 404, username: this.username
            };
        }
    }

    async register() {

        const envs = await getEnvs();
        const poolInfo = await User.getPoolInfo();
        const env = await envs.find(item => item.remarks === this.username);
        if (!env) {
            // 新用户
            if (!poolInfo.allowAdd) {
                throw new UserError('管理员已关闭注册，去其他地方看看吧', 210, 200);
            } else if (poolInfo.marginCount === 0) {
                throw new UserError('本站已到达注册上限，你来晚啦', 211, 200);
            } else {
                const remarks = this.username
                const body = await addEnv(this.cookie, remarks);
                if (body.code !== 200) {
                    throw new UserError(body.message || '添加账户错误，请重试', 220, body.code || 200);
                }
                this.eid = body.data[0].id;
                this.timestamp = body.data[0].timestamp;
                return {
                    errCode: 0,
                    username: this.username,
                    eid: this.eid,
                    msg: `注册成功，${this.username}`,
                    timestamp: this.timestamp
                };
            }
        } else {
            return {
                username: this.username, errCode: 201
            };
        }
    }

    async getUserInfoByEid() {
        const envs = await getEnvs();
        const env = await envs.find((item) => item.id * 1 === this.eid * 1);
        if (!env) {
            throw new UserError('没有找到这个账户，重新登录试试看哦', 230, 200);
        }
        this.cookie = env.value;
        this.timestamp = env.timestamp;
        this.username = env.remarks
        return {
            username: this.username, eid: this.eid, timestamp: this.timestamp, status: env.status
        };
    }

    async update() {
        if (!this.eid) {
            throw new UserError('eid参数错误', 240, 200);
        }
        const envs = await getEnvs();
        const env = await envs.find((item) => item.id === this.eid);
        if (!env) {
            throw new UserError('未查询到账号，尝试重新登录！', 230, 200);
        }
        let cookie;
        if (this.ck) {
            cookie = this.ck
        } else {
            cookie = env.value
        }
        let remarks;
        if (this.username) {
            remarks = this.username;
        } else {
            remarks = env.remarks
        }
        const updateEnvBody = await updateEnv(cookie, this.eid, remarks);
        if (updateEnvBody.code !== 200) {
            throw new UserError('更新出错，尝试重新登录后重试', 241, 500);
        }
        return {
            code: 200, msg: '更新成功'
        };
    }

    async delUserByEid() {
        await this.getUserInfoByEid();
        const body = await delEnv(this.eid);
        if (body.code !== 200) {
            throw new UserError(body.message || '删除账号出错，尝试重新登录后重试', 240, body.code || 500);
        }
        return {
            code: 200, msg: '账户已移除'
        };
    }

    async disableEnv() {
        await this.getUserInfoByEid();
        const body = await disable(this.eid);
        if (body.code !== 200) {
            throw new UserError(body.message || 'CK禁用失败，尝试重新登录后重试', 240, body.code || 500);
        }
        return {
            code: 200, msg: 'CK禁用成功'
        };
    }

    async enableEnv() {
        await this.getUserInfoByEid();
        const body = await enable(this.eid);
        if (body.code !== 200) {
            throw new UserError(body.message || 'CK启用失败，尝试重新登录后重试', 240, body.code || 500);
        }
        return {
            code: 200, msg: 'CK启用成功'
        };
    }

    static async getPoolInfo() {
        const count = await getEnvsCount();
        const allowCount = (process.env.ALLOW_NUM || 40) - count;

        return {
            marginCount: allowCount >= 0 ? allowCount : 0, allowAdd: Boolean(process.env.ALLOW_ADD) || false,
        };
    }
};

class UserError extends Error {
    constructor(message, status, statusCode) {
        super(message);
        this.name = 'UserError';
        this.status = status;
        this.statusCode = statusCode || 500;
    }
}
