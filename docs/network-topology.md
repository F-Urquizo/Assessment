# Network Topology — EquipoFran (infra4)

## Overview

The deployment uses a Cisco router (router4) with two interfaces: one facing the Tec university network and one facing the internal VLAN where all VMs live. External access is provided exclusively via PAT (Port Address Translation) on the router's public IP.

---

## Router: router4

| Interface            | IP Address  | Subnet              | Role                                 |
| -------------------- | ----------- | ------------------- | ------------------------------------ |
| GigabitEthernet0/0/0 | 172.16.40.1 | 255.255.255.0 (/24) | Internal — NAT inside (VLAN 40)      |
| GigabitEthernet0/0/1 | 10.49.12.7  | 10.49.12.0/26       | External — NAT outside (Tec network) |

**Default route:** `0.0.0.0/0` via `10.49.12.61` (upstream gateway)

---

## Internal Network — VLAN 40 (172.16.40.0/24)

### EquipoFran VMs (project infra4)

| Hostname         | Internal IP   | Role                              | Ports open internally                   |
| ---------------- | ------------- | --------------------------------- | --------------------------------------- |
| JumpServerFran   | 172.16.40.160 | SSH gateway                       | 2222                                    |
| LoadBalancerFran | 172.16.40.176 | Nginx (TLS + SPA + reverse proxy) | 443, 80, 2222                           |
| BackEnd1Fran     | 172.16.40.167 | NestJS API #1                     | 3000 (from LoadBalancerFran only), 2222 |
| BackEnd2Fran     | 172.16.40.103 | NestJS API #2                     | 3000 (from LoadBalancerFran only), 2222 |
| DataBaseFran     | 172.16.40.104 | PostgreSQL                        | 5432 (from BackEnd1+2 only), 2222       |
| Ubuntu (equipo4) | 172.16.40.2   | ML model service (Flask)          | 5050 (from BackEnd1+2 only)             |

### Other team VMs (shared router)

| Internal IP   | External mapping | Role                 |
| ------------- | ---------------- | -------------------- |
| 172.16.40.111 | 10.49.12.7:8443  | HTTPS entry point    |
| 172.16.40.147 | 10.49.12.7:2222  | SSH (port 22 inside) |

---

## PAT Rules (router4)

| External (public) | Internal (private) | Protocol | Purpose                   |
| ----------------- | ------------------ | -------- | ------------------------- |
| 10.49.12.7:5022   | 172.16.40.160:2222 | TCP      | SSH to JumpServerFran     |
| 10.49.12.7:4443   | 172.16.40.176:443  | TCP      | HTTPS to LoadBalancerFran |
| 10.49.12.7:2222   | 172.16.40.147:22   | TCP      | SSH — other team          |
| 10.49.12.7:8443   | 172.16.40.111:443  | TCP      | HTTPS — other team        |

PAT overload (dynamic NAT for outbound traffic): all internal hosts use `GigabitEthernet0/0/1` (10.49.12.7) for internet access via ACL 100.

---

## Traffic Flow Diagram

```
Tec University Network
        │
        │  10.49.12.0/26
        │  gateway: 10.49.12.61
        │
┌───────┴──────────────────────────────────────┐
│  router4                                     │
│                                              │
│  Gi0/0/1  10.49.12.7  (NAT outside)         │
│  Gi0/0/0  172.16.40.1 (NAT inside)          │
│                                              │
│  PAT rules:                                  │
│  :5022 → JumpServerFran:2222  (SSH)          │
│  :4443 → LoadBalancerFran:443 (HTTPS)        │
└───────┬──────────────────────────────────────┘
        │
        │  172.16.40.0/24  (VLAN 40)
        │
   ┌────┴────────────────────────────────────────────────┐
   │                                                     │
   ▼                                                     ▼
┌──────────────────┐                    ┌────────────────────────────┐
│  JumpServerFran  │                    │  LoadBalancerFran          │
│  172.16.40.160   │                    │  172.16.40.176             │
│  SSH :2222       │                    │  Nginx — TLS :443          │
│  (SSH gateway)   │                    │  SPA static files          │
└──────────────────┘                    │  Round-robin → backends    │
                                        └──────────┬─────────────────┘
                                                   │
                                    ┌──────────────┴──────────────┐
                                    ▼                             ▼
                         ┌─────────────────┐          ┌─────────────────┐
                         │  BackEnd1Fran   │          │  BackEnd2Fran   │
                         │  172.16.40.167  │          │  172.16.40.103  │
                         │  NestJS :3000   │          │  NestJS :3000   │
                         └────────┬────────┘          └────────┬────────┘
                                  │                            │
                          ┌───────┴────────────────────────────┘
                          │
              ┌───────────┴─────────────────────────────┐
              │                                         │
              ▼                                         ▼
   ┌──────────────────────┐              ┌──────────────────────┐
   │  DataBaseFran        │              │  Ubuntu (equipo4)    │
   │  172.16.40.104       │              │  172.16.40.2         │
   │  PostgreSQL :5432    │              │  ML model service    │
   └──────────────────────┘              │  Flask/Gunicorn :5050│
                                         └──────────────────────┘
```

---

## Services Running Per VM

| VM               | Process                                    | Managed by    |
| ---------------- | ------------------------------------------ | ------------- |
| JumpServerFran   | — (SSH gateway only)                       | —             |
| LoadBalancerFran | Nginx (TLS + reverse proxy + static files) | systemctl     |
| BackEnd1Fran     | NestJS (port 3000)                         | PM2 + systemd |
| BackEnd2Fran     | NestJS (port 3000)                         | PM2 + systemd |
| DataBaseFran     | PostgreSQL (port 5432)                     | systemctl     |
| Ubuntu (equipo4) | Flask + Gunicorn (port 5050)               | systemd       |

---

## Firewall Summary

### OpenStack Security Groups

| Security Group | Applied to                                         | Rules            |
| -------------- | -------------------------------------------------- | ---------------- |
| JumpServerFran | JumpServerFran                                     | TCP 2222 inbound |
| VMsFran        | LoadBalancerFran, BackEnd1, BackEnd2, DataBaseFran | TCP 2222 inbound |

### iptables (inside each VM)

| VM               | Allowed inbound                                                                      |
| ---------------- | ------------------------------------------------------------------------------------ |
| JumpServerFran   | TCP 2222, ESTABLISHED/RELATED, loopback                                              |
| LoadBalancerFran | TCP 443, TCP 80, TCP 2222, ESTABLISHED/RELATED, loopback                             |
| BackEnd1Fran     | TCP 3000 from 172.16.40.176, TCP 2222, ESTABLISHED/RELATED, loopback                 |
| BackEnd2Fran     | TCP 3000 from 172.16.40.176, TCP 2222, ESTABLISHED/RELATED, loopback                 |
| DataBaseFran     | TCP 5432 from 172.16.40.167 + 172.16.40.103, TCP 2222, ESTABLISHED/RELATED, loopback |

### ufw (Ubuntu — model service)

| Rule  | Source                   | Port |
| ----- | ------------------------ | ---- |
| ALLOW | 172.16.40.167 (BackEnd1) | 5050 |
| ALLOW | 172.16.40.103 (BackEnd2) | 5050 |

---

## SSH Access

All VM access goes through JumpServerFran. From your laptop:

```
ssh -p 5022 EquipoFran@10.49.12.7          # JumpServerFran
ssh -p 2222 EquipoFran@172.16.40.176       # LoadBalancerFran (from JumpServer)
ssh -p 2222 EquipoFran@172.16.40.167       # BackEnd1Fran (from JumpServer)
ssh -p 2222 EquipoFran@172.16.40.103       # BackEnd2Fran (from JumpServer)
ssh -p 2222 EquipoFran@172.16.40.104       # DataBaseFran (from JumpServer)
```
