import React, { useEffect, useRef } from 'react';

/**
 * ParticleEngine
 * A high-performance Canvas-based cinematic particle system.
 * Features:
 * - 3-Layer Depth System (Fore, Mid, Back)
 * - Cinematic diagonal drift
 * - Natural opacity pulsing & shimmer
 * - Theme-aware colors
 * - Ultra-smooth 60FPS with requestAnimationFrame
 */
const ParticleEngine = () => {
    const canvasRef = useRef(null);
    const mouseRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        // Configuration
        const PARTICLE_COUNT = 55;
        const STREAK_COUNT = 4;
        const layers = [
            { count: PARTICLE_COUNT * 0.25, speed: 0.15, size: [1, 2], blur: 0, opacity: [0.1, 0.4], parallax: 0.02 }, // Back
            { count: PARTICLE_COUNT * 0.45, speed: 0.1, size: [2, 4], blur: 2, opacity: [0.2, 0.6], parallax: 0.05 }, // Mid
            { count: PARTICLE_COUNT * 0.3, speed: 0.05, size: [5, 10], blur: 8, opacity: [0.1, 0.3], parallax: 0.1 }, // Fore
        ];

        let particles = [];
        let streaks = [];
        let width, height;

        const getAccentColor = () => {
            const style = getComputedStyle(document.documentElement);
            return style.getPropertyValue('--bg-accent').trim() || '#D7AC28';
        };

        const resize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            init();
        };

        const onMouseMove = (e) => {
            mouseRef.current = {
                x: (e.clientX - width / 2) / (width / 2),
                y: (e.clientY - height / 2) / (height / 2)
            };
        };

        class Particle {
            constructor(layer) {
                this.layer = layer;
                this.reset();
            }

            reset() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.baseX = this.x;
                this.baseY = this.y;
                this.vx = (Math.random() * 0.5 + 0.2) * this.layer.speed; 
                this.vy = (Math.random() * 0.5 - 0.25) * this.layer.speed;
                this.size = Math.random() * (this.layer.size[1] - this.layer.size[0]) + this.layer.size[0];
                this.opacity = 0;
                this.maxOpacity = Math.random() * (this.layer.opacity[1] - this.layer.opacity[0]) + this.layer.opacity[0];
                this.fadeSpeed = Math.random() * 0.005 + 0.002;
                this.fadingIn = true;
                this.shimmerOffset = Math.random() * Math.PI * 2;
            }

            update() {
                this.baseX += this.vx;
                this.baseY += this.vy;

                // Mouse Parallax Calculation
                const px = mouseRef.current.x * width * this.layer.parallax;
                const py = mouseRef.current.y * height * this.layer.parallax;
                
                this.x = this.baseX - px;
                this.y = this.baseY - py;

                // Loop around screen (using base positions)
                if (this.baseX > width + 100) this.baseX = -100;
                if (this.baseX < -100) this.baseX = width + 100;
                if (this.baseY > height + 100) this.baseY = -100;
                if (this.baseY < -100) this.baseY = height + 100;

                if (this.fadingIn) {
                    this.opacity += this.fadeSpeed;
                    if (this.opacity >= this.maxOpacity) this.fadingIn = false;
                } else {
                    this.shimmer = Math.sin(Date.now() * 0.001 + this.shimmerOffset) * 0.1;
                }
            }

            draw() {
                const accentColor = getAccentColor();
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                
                if (this.layer.blur > 0) {
                    ctx.shadowBlur = this.layer.blur;
                    ctx.shadowColor = accentColor;
                } else {
                    ctx.shadowBlur = 0;
                }

                ctx.fillStyle = accentColor;
                ctx.globalAlpha = Math.max(0, this.opacity + (this.shimmer || 0));
                ctx.fill();
            }
        }

        class LightStreak {
            constructor() {
                this.reset();
            }

            reset() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.length = Math.random() * 200 + 100;
                this.angle = Math.PI / 4; // Diagonal
                this.speed = Math.random() * 0.2 + 0.1;
                this.opacity = 0;
                this.maxOpacity = 0.05;
                this.life = Math.random() * 200 + 100;
            }

            update() {
                this.x += Math.cos(this.angle) * this.speed;
                this.y += Math.sin(this.angle) * this.speed;
                this.life--;
                
                if (this.life > 50) this.opacity = Math.min(this.maxOpacity, this.opacity + 0.001);
                else this.opacity = Math.max(0, this.opacity - 0.001);

                if (this.life <= 0) this.reset();
            }

            draw() {
                const accentColor = getAccentColor();
                const grad = ctx.createLinearGradient(
                    this.x, this.y, 
                    this.x + Math.cos(this.angle) * this.length, 
                    this.y + Math.sin(this.angle) * this.length
                );
                grad.addColorStop(0, 'transparent');
                grad.addColorStop(0.5, accentColor);
                grad.addColorStop(1, 'transparent');

                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x + Math.cos(this.angle) * this.length, this.y + Math.sin(this.angle) * this.length);
                ctx.lineWidth = 1;
                ctx.strokeStyle = grad;
                ctx.globalAlpha = this.opacity;
                ctx.stroke();
            }
        }

        const init = () => {
            particles = [];
            streaks = [];
            layers.forEach(layer => {
                for (let i = 0; i < layer.count; i++) {
                    particles.push(new Particle(layer));
                }
            });
            for (let i = 0; i < STREAK_COUNT; i++) {
                streaks.push(new LightStreak());
            }
        };

        const render = () => {
            ctx.clearRect(0, 0, width, height);
            
            // Additive blending for premium glow
            ctx.globalCompositeOperation = 'lighter';

            streaks.forEach(s => {
                s.update();
                s.draw();
            });

            particles.forEach(p => {
                p.update();
                p.draw();
            });

            animationFrameId = requestAnimationFrame(render);
        };

        window.addEventListener('resize', resize);
        window.addEventListener('mousemove', onMouseMove);
        resize();
        render();

        return () => {
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousemove', onMouseMove);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-0"
            style={{ 
                mixBlendMode: 'screen',
                filter: 'contrast(1.1) brightness(1.1)',
                willChange: 'transform'
            }}
        />
    );
};

export default ParticleEngine;
