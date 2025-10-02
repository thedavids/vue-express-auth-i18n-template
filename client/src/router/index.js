import { createRouter, createWebHistory } from 'vue-router';
import Home from '../views/Home.vue';
import Login from '../views/authentication/Login.vue';
import Signup from '../views/authentication/Signup.vue';
import VerifyEmail from '../views/authentication/VerifyEmail.vue';
import ForgotPassword from '../views/authentication/ForgotPassword.vue';
import ResetPassword from '../views/authentication/ResetPassword.vue';
import Profile from '../views/profile/ProfileSettings.vue';

const routes = [
    { path: '/', component: Home },
    { path: '/login', component: Login },
    { path: '/signup', component: Signup },
    { path: '/verify', component: VerifyEmail },
    { path: '/profile', component: Profile },
    { path: '/forgot-password', component: ForgotPassword },
    { path: '/reset-password', component: ResetPassword },
    { path: '/index.html', redirect: '/' }
];

export const router = createRouter({
    history: createWebHistory(),
    routes
});