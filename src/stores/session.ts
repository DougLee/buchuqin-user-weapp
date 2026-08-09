import{defineStore}from'pinia';import{api}from'../api'
export const useSessionStore=defineStore('session',{state:()=>({ready:false,user:null as null|Record<string,string>}),actions:{async ensureLogin(){if(this.ready)return;const cached=uni.getStorageSync('token');if(!cached){const result=await api.login();uni.setStorageSync('token',result.token);this.user=result.user}this.ready=true}}})
